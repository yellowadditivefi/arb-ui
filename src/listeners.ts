"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWithdrawal = exports.resolveExistingWithdrawals = exports.getWithdrawalQuote = exports.setupEngineListeners = void 0;
const vector_contracts_1 = require("@connext/vector-contracts");
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const address_1 = require("@ethersproject/address");
const bignumber_1 = require("@ethersproject/bignumber");
const constants_1 = require("@ethersproject/constants");
const pino_1 = __importDefault(require("pino"));
const errors_1 = require("./errors");
const utils_1 = require("./utils");
function setupEngineListeners(evts, chainService, vector, messaging, signer, store, chainAddresses, logger, setup, acquireRestoreLocks, releaseRestoreLocks, gasSubsidyPercentage) {
    return __awaiter(this, void 0, void 0, function* () {
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => handleSetup(event, signer, vector, evts, logger), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.setup;
        });
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => handleDepositReconciliation(event, signer, vector, evts, logger), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.deposit;
        });
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => __awaiter(this, void 0, void 0, function* () { return yield handleConditionalTransferCreation(event, store, chainService, chainAddresses, evts, logger); }), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.create;
        });
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => __awaiter(this, void 0, void 0, function* () { return yield handleConditionalTransferResolution(event, chainAddresses, store, chainService, evts, logger); }), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.resolve;
        });
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => __awaiter(this, void 0, void 0, function* () {
            return yield handleWithdrawalTransferCreation(event, signer, vector, store, evts, chainAddresses, chainService, logger, gasSubsidyPercentage);
        }), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.create;
        });
        vector.on(vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT, (event) => __awaiter(this, void 0, void 0, function* () { return yield handleWithdrawalTransferResolution(event, signer, store, evts, chainAddresses, chainService, logger); }), (event) => {
            const { updatedChannelState: { latestUpdate: { type }, }, } = event;
            return type === vector_types_1.UpdateType.resolve;
        });
        yield messaging.onReceiveRestoreStateMessage(signer.publicIdentifier, (restoreData, from, inbox) => __awaiter(this, void 0, void 0, function* () {
            if (from === signer.publicIdentifier) {
                return;
            }
            const method = "onReceiveRestoreStateMessage";
            logger.debug({ method }, "Handling message");
            const releaseLockAndAck = (channelAddress, postToEvt = false) => __awaiter(this, void 0, void 0, function* () {
                const channel = yield store.getChannelState(channelAddress);
                if (!channel) {
                    logger.error({ channelAddress }, "Failed to find channel to release lock");
                    return;
                }
                yield releaseRestoreLocks(channel);
                yield messaging.respondToRestoreStateMessage(inbox, vector_types_1.Result.ok(undefined));
                if (postToEvt) {
                    evts[vector_types_1.EngineEvents.RESTORE_STATE_EVENT].post({
                        channelAddress: channel.channelAddress,
                        aliceIdentifier: channel.aliceIdentifier,
                        bobIdentifier: channel.bobIdentifier,
                        chainId: channel.networkContext.chainId,
                    });
                }
                return;
            });
            if (restoreData.isError) {
                logger.error({ message: restoreData.getError().message, method }, "Error received from counterparty restore");
                yield releaseLockAndAck(restoreData.getError().context.channelAddress);
                return;
            }
            const data = restoreData.getValue();
            const [key] = Object.keys(data !== null && data !== void 0 ? data : []);
            if (key !== "chainId" && key !== "channelAddress") {
                logger.error({ data }, "Message malformed");
                return;
            }
            if (key === "channelAddress") {
                const { channelAddress } = data;
                yield releaseLockAndAck(channelAddress, true);
                return;
            }
            let channel;
            const sendCannotRestoreFromError = (error, context = {}) => {
                var _a;
                return messaging.respondToRestoreStateMessage(inbox, vector_types_1.Result.fail(new errors_1.RestoreError(error, (_a = channel === null || channel === void 0 ? void 0 : channel.channelAddress) !== null && _a !== void 0 ? _a : "", signer.publicIdentifier, Object.assign(Object.assign({}, context), { method }))));
            };
            const { chainId } = data;
            try {
                channel = yield store.getChannelStateByParticipants(signer.publicIdentifier, from, chainId);
            }
            catch (e) {
                return sendCannotRestoreFromError(errors_1.RestoreError.reasons.CouldNotGetChannel, {
                    storeMethod: "getChannelStateByParticipants",
                    chainId,
                    identifiers: [signer.publicIdentifier, from],
                });
            }
            if (!channel) {
                return sendCannotRestoreFromError(errors_1.RestoreError.reasons.ChannelNotFound, { chainId });
            }
            let activeTransfers;
            try {
                activeTransfers = yield store.getActiveTransfers(channel.channelAddress);
            }
            catch (e) {
                return sendCannotRestoreFromError(errors_1.RestoreError.reasons.CouldNotGetActiveTransfers, {
                    storeMethod: "getActiveTransfers",
                    chainId,
                    channelAddress: channel.channelAddress,
                });
            }
            const res = yield acquireRestoreLocks(channel);
            if (res.isError) {
                return sendCannotRestoreFromError(errors_1.RestoreError.reasons.AcquireLockError, {
                    acquireLockError: vector_types_1.jsonifyError(res.getError()),
                });
            }
            logger.debug({
                channel: channel.channelAddress,
                nonce: channel.nonce,
                activeTransfers: activeTransfers.map((a) => a.transferId),
            }, "Sending counterparty state to sync");
            yield messaging.respondToRestoreStateMessage(inbox, vector_types_1.Result.ok({ channel, activeTransfers }));
            setTimeout(() => {
                releaseRestoreLocks(channel);
            }, 15000);
        }));
        yield messaging.onReceiveIsAliveMessage(signer.publicIdentifier, (params, from, inbox) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const needsResponse = from !== signer.publicIdentifier;
            const method = "onReceiveIsAliveMessage";
            const methodId = vector_utils_1.getRandomBytes32();
            if (params.isError) {
                logger.warn({ error: (_a = params.getError()) === null || _a === void 0 ? void 0 : _a.message, method, methodId }, "Error received");
                return;
            }
            const { channelAddress } = params.getValue();
            const channel = yield store.getChannelState(channelAddress);
            if (!channel) {
                logger.error({ channelAddress, method, methodId }, "Channel not found");
                needsResponse &&
                    messaging.respondToIsAliveMessage(inbox, vector_types_1.Result.fail(new errors_1.IsAliveError(errors_1.IsAliveError.reasons.ChannelNotFound, channelAddress, signer.publicIdentifier)));
                return;
            }
            evts[vector_types_1.IS_ALIVE_EVENT].post({
                aliceIdentifier: channel.aliceIdentifier,
                bobIdentifier: channel.bobIdentifier,
                chainId: channel.networkContext.chainId,
                channelAddress: channel.channelAddress,
                skipCheckIn: (_b = params.getValue().skipCheckIn) !== null && _b !== void 0 ? _b : false,
            });
            resolveExistingWithdrawals(channel, signer, store, vector, chainAddresses, chainService, evts, logger, gasSubsidyPercentage);
            if (!needsResponse) {
                return;
            }
            yield messaging.respondToIsAliveMessage(inbox, vector_types_1.Result.ok({ channelAddress }));
            return;
        }));
        yield messaging.onReceiveRequestCollateralMessage(signer.publicIdentifier, (params, from, inbox) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            const method = "onReceiveRequestCollateralMessage";
            if (params.isError) {
                logger.error({ error: (_c = params.getError()) === null || _c === void 0 ? void 0 : _c.message, method }, "Error received");
                return;
            }
            logger.info({ params: params.getValue(), method, from }, "Handling message");
            evts[vector_types_1.REQUEST_COLLATERAL_EVENT].post(Object.assign(Object.assign({}, params.getValue()), { aliceIdentifier: signer.publicIdentifier, bobIdentifier: from }));
            yield messaging.respondToRequestCollateralMessage(inbox, vector_types_1.Result.ok({ message: "Successfully requested collateral" }));
        }));
        yield messaging.onReceiveSetupMessage(signer.publicIdentifier, (params, from, inbox) => __awaiter(this, void 0, void 0, function* () {
            var _d;
            const method = "onReceiveSetupMessage";
            if (params.isError) {
                logger.error({ error: (_d = params.getError()) === null || _d === void 0 ? void 0 : _d.message, method }, "Error received");
                return;
            }
            const setupInfo = params.getValue();
            logger.info({ params: setupInfo, method }, "Handling message");
            const res = yield setup({
                chainId: setupInfo.chainId,
                counterpartyIdentifier: from,
                timeout: setupInfo.timeout,
                meta: setupInfo.meta,
            });
            yield messaging.respondToSetupMessage(inbox, res.isError ? vector_types_1.Result.fail(res.getError()) : vector_types_1.Result.ok({ channelAddress: res.getValue().channelAddress }));
        }));
        yield messaging.onReceiveWithdrawalQuoteMessage(signer.publicIdentifier, (quoteRequest, from, inbox) => __awaiter(this, void 0, void 0, function* () {
            var _e;
            const method = "onReceiveWithdrawalQuoteMessage";
            const methodId = vector_utils_1.getRandomBytes32();
            logger.info({ method, methodId, quoteRequest: quoteRequest.toJson() }, "Method started");
            if (quoteRequest.isError) {
                logger.error({ error: (_e = quoteRequest.getError()) === null || _e === void 0 ? void 0 : _e.message, method, methodId }, "Error received");
                return;
            }
            const request = quoteRequest.getValue();
            logger.info(Object.assign(Object.assign({}, request), { method, methodId }), "Calculating quote");
            const calculatedQuote = yield getWithdrawalQuote(request, gasSubsidyPercentage, signer, store, chainService, logger);
            yield messaging.respondToWithdrawalQuoteMessage(inbox, calculatedQuote);
            logger.info({ quote: calculatedQuote.toJson(), method, methodId }, "Method complete");
        }));
        chainService.on(vector_types_1.EngineEvents.TRANSACTION_SUBMITTED, (data) => {
            evts[vector_types_1.EngineEvents.TRANSACTION_SUBMITTED].post(Object.assign(Object.assign({}, data), { publicIdentifier: signer.publicIdentifier }));
        });
        chainService.on(vector_types_1.EngineEvents.TRANSACTION_MINED, (data) => {
            evts[vector_types_1.EngineEvents.TRANSACTION_MINED].post(Object.assign(Object.assign({}, data), { publicIdentifier: signer.publicIdentifier }));
        });
        chainService.on(vector_types_1.EngineEvents.TRANSACTION_FAILED, (data) => {
            evts[vector_types_1.EngineEvents.TRANSACTION_FAILED].post(Object.assign(Object.assign({}, data), { publicIdentifier: signer.publicIdentifier }));
        });
    });
}
exports.setupEngineListeners = setupEngineListeners;
function getWithdrawalQuote(request, gasSubsidyPercentage, signer, store, chainService, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        const createAndSignQuote = (_fee) => __awaiter(this, void 0, void 0, function* () {
            const quote = {
                channelAddress: request.channelAddress,
                amount: _fee.gt(request.amount) ? "0" : bignumber_1.BigNumber.from(request.amount).sub(_fee).toString(),
                assetId: request.assetId,
                fee: _fee.toString(),
                expiry: (Date.now() + 30000).toString(),
            };
            try {
                const signature = yield signer.signMessage(vector_utils_1.hashWithdrawalQuote(quote));
                return vector_types_1.Result.ok(Object.assign(Object.assign({}, quote), { signature }));
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.SignatureFailure, signer.publicIdentifier, request, {
                    error: vector_types_1.jsonifyError(e),
                }));
            }
        });
        if (gasSubsidyPercentage === 100) {
            return createAndSignQuote(constants_1.Zero);
        }
        const channel = yield store.getChannelState(request.channelAddress);
        if (!channel) {
            return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.ChannelNotFound, signer.publicIdentifier, request));
        }
        const code = yield chainService.getCode(request.channelAddress, channel.networkContext.chainId);
        if (code.isError) {
            return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.ChainServiceFailure, signer.publicIdentifier, request, {
                chainServiceMethod: "getCode",
                error: vector_types_1.jsonifyError(code.getError()),
            }));
        }
        const gasEstimate = code.getValue() !== "0x" ? vector_types_1.GAS_ESTIMATES.withdraw : vector_types_1.GAS_ESTIMATES.withdraw.add(vector_types_1.GAS_ESTIMATES.createChannel);
        const gasPrice = yield chainService.getGasPrice(channel.networkContext.chainId);
        if (gasPrice.isError) {
            return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.ChainServiceFailure, signer.publicIdentifier, request, {
                chainServiceMethod: "getGasPrice",
                error: vector_types_1.jsonifyError(gasPrice.getError()),
            }));
        }
        const assetDecimals = yield chainService.getDecimals(request.assetId, channel.networkContext.chainId);
        if (assetDecimals.isError) {
            return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.ChainServiceFailure, signer.publicIdentifier, request, {
                chainServiceMethod: "getDecimals",
                error: vector_types_1.jsonifyError(assetDecimals.getError()),
            }));
        }
        const normalizedGasCost = channel.networkContext.chainId === 1 || vector_utils_1.TESTNETS_WITH_FEES.includes(channel.networkContext.chainId)
            ? yield utils_1.normalizeGasFees(gasEstimate, 18, request.assetId, assetDecimals.getValue(), channel.networkContext.chainId, chainService, logger)
            : vector_types_1.Result.ok(constants_1.Zero);
        if (normalizedGasCost.isError) {
            return vector_types_1.Result.fail(new errors_1.WithdrawQuoteError(errors_1.WithdrawQuoteError.reasons.ExchangeRateError, signer.publicIdentifier, request, {
                error: vector_types_1.jsonifyError(normalizedGasCost.getError()),
            }));
        }
        const fee = normalizedGasCost
            .getValue()
            .mul(100 - gasSubsidyPercentage)
            .div(100);
        return createAndSignQuote(fee);
    });
}
exports.getWithdrawalQuote = getWithdrawalQuote;
function resolveExistingWithdrawals(channel, signer, store, vector, chainAddresses, chainService, evts, logger, gasSubsidyPercentage) {
    return __awaiter(this, void 0, void 0, function* () {
        const method = "resolveExistingWithdrawals";
        const methodId = vector_utils_1.getRandomBytes32();
        const activeTransfers = yield vector.getActiveTransfers(channel.channelAddress);
        logger.info({ method, methodId }, "Got active transfers in isAlive channel");
        const withdrawalsOnlyPromises = yield Promise.all(activeTransfers.map((transfer) => __awaiter(this, void 0, void 0, function* () {
            const isWithdraw = yield isWithdrawTransfer(transfer, chainAddresses, chainService);
            return !isWithdraw.isError && isWithdraw.getValue() ? transfer : undefined;
        })));
        const withdrawalsOnly = withdrawalsOnlyPromises.filter((x) => !!x);
        const withdrawalsToComplete = withdrawalsOnly.filter((transfer) => __awaiter(this, void 0, void 0, function* () {
            return transfer.responderIdentifier === signer.publicIdentifier;
        }));
        yield Promise.all(withdrawalsToComplete.map((transfer) => __awaiter(this, void 0, void 0, function* () {
            logger.info({ method, methodId, transfer: transfer.transferId }, "Found withdrawal to handle");
            yield exports.resolveWithdrawal(channel, transfer, vector, evts, store, signer, chainService, logger, gasSubsidyPercentage);
            logger.info({ method, methodId, transfer: transfer.transferId }, "Resolved withdrawal");
        })));
    });
}
exports.resolveExistingWithdrawals = resolveExistingWithdrawals;
function handleSetup(event, signer, vector, evts, logger) {
    logger.info({ channelAddress: event.updatedChannelState.channelAddress }, "Handling setup event");
    const { channelAddress, aliceIdentifier, bobIdentifier, networkContext: { chainId }, latestUpdate: { details: { meta }, }, } = event.updatedChannelState;
    const payload = {
        channelAddress,
        aliceIdentifier,
        bobIdentifier,
        chainId,
        meta,
    };
    evts[vector_types_1.EngineEvents.SETUP].post(payload);
}
function handleDepositReconciliation(event, signer, vector, evts, logger) {
    logger.info({ channelAddress: event.updatedChannelState.channelAddress }, "Handling deposit reconciliation event");
    const { aliceIdentifier, bobIdentifier, channelAddress, balances, assetIds, latestUpdate: { assetId, details: { meta }, }, } = event.updatedChannelState;
    const payload = {
        aliceIdentifier,
        bobIdentifier,
        channelAddress,
        assetId,
        channelBalance: balances[assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId))],
        meta,
    };
    evts[vector_types_1.EngineEvents.DEPOSIT_RECONCILED].post(payload);
}
function handleConditionalTransferCreation(event, store, chainService, chainAddresses, evts, logger) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const isWithdrawRes = yield isWithdrawTransfer(event.updatedTransfer, chainAddresses, chainService);
        if (isWithdrawRes.isError) {
            logger.warn(Object.assign({ method: "isWithdrawRes" }, isWithdrawRes.getError().context), "Failed to determine if transfer is withdrawal");
            return;
        }
        if (isWithdrawRes.getValue()) {
            return;
        }
        const { aliceIdentifier, bobIdentifier, assetIds, balances, channelAddress, networkContext: { chainId }, latestUpdate: { assetId, details: { transferId, transferDefinition, meta: { routingId }, }, }, } = event.updatedChannelState;
        logger.info({ channelAddress }, "Handling conditional transfer create event");
        const transfer = event.updatedTransfer;
        if (!transfer) {
            logger.warn({ transferId }, "Transfer not found after creation");
            return;
        }
        const registryInfo = yield chainService.getRegisteredTransferByDefinition(transferDefinition, chainAddresses[chainId].transferRegistryAddress, chainId);
        let conditionType;
        if (registryInfo.isError) {
            logger.warn({ error: registryInfo.getError().message }, "Failed to get registry info");
            conditionType = transferDefinition;
        }
        else {
            conditionType = registryInfo.getValue().name;
        }
        const assetIdx = assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
        const payload = {
            aliceIdentifier,
            bobIdentifier,
            channelAddress,
            channelBalance: balances[assetIdx],
            transfer,
            conditionType,
            activeTransferIds: (_a = event.updatedTransfers) === null || _a === void 0 ? void 0 : _a.map((t) => t.transferId),
        };
        evts[vector_types_1.EngineEvents.CONDITIONAL_TRANSFER_CREATED].post(payload);
        if (!routingId || ((_b = transfer.meta) === null || _b === void 0 ? void 0 : _b.routingId) !== routingId) {
            logger.warn({ transferId, routingId, meta: transfer.meta }, "Cannot route transfer");
            return;
        }
    });
}
function handleConditionalTransferResolution(event, chainAddresses, store, chainService, evts, logger) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const isWithdrawRes = yield isWithdrawTransfer(event.updatedTransfer, chainAddresses, chainService);
        if (isWithdrawRes.isError) {
            logger.warn(Object.assign({ method: "isWithdrawRes" }, isWithdrawRes.getError().context), "Failed to determine if transfer is withdrawal");
            return;
        }
        if (isWithdrawRes.getValue()) {
            return;
        }
        logger.info({ channelAddress: event.updatedChannelState.channelAddress }, "Handling conditional transfer resolve event");
        const { aliceIdentifier, bobIdentifier, channelAddress, assetIds, balances, networkContext: { chainId }, latestUpdate: { assetId, details: { transferDefinition }, }, } = event.updatedChannelState;
        const registryInfo = yield chainService.getRegisteredTransferByDefinition(transferDefinition, chainAddresses[chainId].transferRegistryAddress, chainId);
        let conditionType;
        if (registryInfo.isError) {
            logger.warn({ error: registryInfo.getError().message }, "Faild to get registry info");
            conditionType = transferDefinition;
        }
        else {
            conditionType = registryInfo.getValue().name;
        }
        const transfer = event.updatedTransfer;
        const payload = {
            aliceIdentifier,
            bobIdentifier,
            channelAddress,
            channelBalance: balances[assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId))],
            transfer: transfer,
            conditionType,
            activeTransferIds: (_a = event.updatedTransfers) === null || _a === void 0 ? void 0 : _a.map((t) => t.transferId),
        };
        evts[vector_types_1.EngineEvents.CONDITIONAL_TRANSFER_RESOLVED].post(payload);
    });
}
function handleWithdrawalTransferCreation(event, signer, vector, store, evts, chainAddresses, chainService, logger, gasSubsidyPercentage) {
    return __awaiter(this, void 0, void 0, function* () {
        const isWithdrawRes = yield isWithdrawTransfer(event.updatedTransfer, chainAddresses, chainService);
        if (isWithdrawRes.isError) {
            logger.warn({ method: "handleWithdrawalTransferCreation", error: vector_types_1.jsonifyError(isWithdrawRes.getError()) }, "Failed to determine if transfer is withdrawal");
            return;
        }
        if (!isWithdrawRes.getValue()) {
            return;
        }
        yield exports.resolveWithdrawal(event.updatedChannelState, event.updatedTransfer, vector, evts, store, signer, chainService, logger, gasSubsidyPercentage);
    });
}
function handleWithdrawalTransferResolution(event, signer, store, evts, chainAddresses, chainService, logger = pino_1.default()) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const isWithdrawRes = yield isWithdrawTransfer(event.updatedTransfer, chainAddresses, chainService);
        if (isWithdrawRes.isError) {
            logger.warn(Object.assign({ method: "isWithdrawRes" }, isWithdrawRes.getError().context), "Failed to determine if transfer is withdrawal");
            return;
        }
        if (!isWithdrawRes.getValue()) {
            return;
        }
        const method = "handleWithdrawalTransferResolution";
        const methodId = vector_utils_1.getRandomBytes32();
        const { aliceIdentifier, bobIdentifier, channelAddress, balances, assetIds, alice, bob, latestUpdate: { details: { transferId, meta }, assetId, fromIdentifier, }, } = event.updatedChannelState;
        logger.info({ method, channelAddress, transferId, methodId }, "Started");
        if (!event.updatedTransfer) {
            logger.warn({ method, transferId, channelAddress }, "Could not find transfer for withdrawal resolution");
            return;
        }
        const withdrawalAmount = event.updatedTransfer.balance.amount
            .reduce((prev, curr) => prev.add(curr), bignumber_1.BigNumber.from(0))
            .sub(event.updatedTransfer.transferState.fee);
        logger.info({
            method,
            methodId,
            withdrawalAmount: withdrawalAmount.toString(),
            initiator: event.updatedTransfer.initiator,
            responder: event.updatedTransfer.responder,
            fee: event.updatedTransfer.transferState.fee,
        }, "Withdrawal info");
        const assetIdx = assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
        const payload = {
            aliceIdentifier,
            bobIdentifier,
            assetId,
            amount: withdrawalAmount.toString(),
            fee: event.updatedTransfer.transferState.fee,
            recipient: event.updatedTransfer.balance.to[0],
            channelBalance: balances[assetIdx],
            channelAddress,
            transfer: event.updatedTransfer,
            callTo: event.updatedTransfer.transferState.callTo,
            callData: event.updatedTransfer.transferState.callData,
        };
        evts[vector_types_1.EngineEvents.WITHDRAWAL_RESOLVED].post(payload);
        if (fromIdentifier === signer.publicIdentifier) {
            logger.debug({ method, methodId, withdrawalAmount: withdrawalAmount.toString(), assetId }, "Our own resolution, no need to do anything");
            return;
        }
        const commitment = new vector_contracts_1.WithdrawCommitment(channelAddress, alice, bob, event.updatedTransfer.balance.to[0], assetId, withdrawalAmount.toString(), event.updatedTransfer.transferState.nonce, event.updatedTransfer.transferState.callTo, event.updatedTransfer.transferState.callData, (_a = meta === null || meta === void 0 ? void 0 : meta.transactionHash) !== null && _a !== void 0 ? _a : undefined);
        yield commitment.addSignatures(event.updatedTransfer.transferState.initiatorSignature, event.updatedTransfer.transferResolver.responderSignature);
        if (signer.address !== alice) {
            evts[vector_types_1.WITHDRAWAL_RECONCILED_EVENT].post({
                aliceIdentifier,
                bobIdentifier,
                channelAddress,
                transferId,
                transactionHash: meta === null || meta === void 0 ? void 0 : meta.transactionHash,
                meta: event.updatedTransfer.meta,
            });
            yield store.saveWithdrawalCommitment(transferId, commitment.toJson());
            logger.info({ method, methodId, withdrawalAmount: withdrawalAmount.toString(), assetId }, "Completed");
            return;
        }
        if (event.updatedChannelState.networkContext.chainId === 1) {
            yield store.saveWithdrawalCommitment(transferId, commitment.toJson());
            logger.debug({ method, channel: event.updatedChannelState.channelAddress }, "Holding mainnet withdrawal");
            return;
        }
        const withdrawalResponse = yield chainService.sendWithdrawTx(event.updatedChannelState, commitment.getSignedTransaction());
        if (withdrawalResponse.isError) {
            yield store.saveWithdrawalCommitment(transferId, commitment.toJson());
            logger.warn({ method, error: withdrawalResponse.getError().message, channelAddress, transferId }, "Failed to submit withdraw");
            return;
        }
        const tx = withdrawalResponse.getValue();
        commitment.addTransaction(tx.hash);
        yield store.saveWithdrawalCommitment(transferId, commitment.toJson());
        evts[vector_types_1.WITHDRAWAL_RECONCILED_EVENT].post({
            aliceIdentifier,
            bobIdentifier,
            channelAddress,
            transferId,
            transactionHash: tx.hash,
        });
        logger.info({ transactionHash: tx.hash }, "Submitted withdraw tx");
        const receipt = yield tx.wait();
        if (receipt.status === 0) {
            logger.error({ method, receipt }, "Withdraw tx reverted");
        }
        else {
            logger.info({ method, transactionHash: receipt.transactionHash }, "Withdraw tx mined, completed");
        }
    });
}
const isWithdrawTransfer = (transfer, chainAddresses, chainService) => __awaiter(void 0, void 0, void 0, function* () {
    const withdrawInfo = yield chainService.getRegisteredTransferByName(vector_types_1.TransferNames.Withdraw, chainAddresses[transfer.chainId].transferRegistryAddress, transfer.chainId);
    if (withdrawInfo.isError) {
        return vector_types_1.Result.fail(withdrawInfo.getError());
    }
    const { definition } = withdrawInfo.getValue();
    return vector_types_1.Result.ok(transfer.transferDefinition === definition);
});
exports.resolveWithdrawal = (channelState, transfer, vector, evts, store, signer, chainService, logger, gasSubsidyPercentage) => __awaiter(void 0, void 0, void 0, function* () {
    const method = "resolveWithdrawal";
    const methodId = vector_utils_1.getRandomBytes32();
    const { aliceIdentifier, bobIdentifier, channelAddress, balances, assetIds, alice, bob, } = channelState;
    logger.info({ channelAddress, transferId: transfer.transferId, assetId: transfer.assetId, method, methodId }, "Started");
    const { meta, assetId, balance, initiatorIdentifier, transferId, transferState: { nonce, initiatorSignature, fee, initiator, responder, callTo, callData }, } = transfer;
    const withdrawalAmount = balance.amount.reduce((prev, curr) => prev.add(curr), bignumber_1.BigNumber.from(0)).sub(fee);
    logger.debug({ withdrawalAmount: withdrawalAmount.toString(), initiator, responder, fee }, "Withdrawal info");
    const assetIdx = assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
    const payload = {
        aliceIdentifier,
        bobIdentifier,
        assetId,
        amount: withdrawalAmount.toString(),
        fee,
        recipient: balance.to[0],
        channelBalance: balances[assetIdx],
        channelAddress,
        transfer,
        callTo,
        callData,
    };
    evts[vector_types_1.EngineEvents.WITHDRAWAL_CREATED].post(payload);
    if (initiatorIdentifier === signer.publicIdentifier) {
        logger.info({ method }, "Waiting for counterparty sig");
        return;
    }
    const relevantChain = transfer.chainId === 1 || vector_utils_1.TESTNETS_WITH_FEES.includes(transfer.chainId);
    if (gasSubsidyPercentage !== 100 && signer.address === channelState.alice && relevantChain) {
        const cancelWithdrawal = (cancellationReason) => __awaiter(void 0, void 0, void 0, function* () {
            logger.warn({ cancellationReason, transferId, channelAddress, method, methodId }, "Cancelling withdrawal");
            const resolveRes = yield vector.resolve({
                transferResolver: { responderSignature: vector_utils_1.mkSig("0x0") },
                transferId,
                channelAddress,
                meta: Object.assign(Object.assign({}, (meta !== null && meta !== void 0 ? meta : {})), { cancellationReason }),
            });
            if (resolveRes.isError) {
                logger.error({
                    method,
                    error: resolveRes.getError().message,
                    transferId,
                    channelAddress,
                    transactionHash,
                }, "Failed to cancel withdrawal");
                return;
            }
        });
        const { quote } = meta !== null && meta !== void 0 ? meta : {};
        if (!quote) {
            yield cancelWithdrawal("Missing withdrawal quote");
            return;
        }
        if (parseInt(quote.expiry) < Date.now()) {
            yield cancelWithdrawal("Withdrawal quote expired, please retry");
            return;
        }
        try {
            const recreated = {
                channelAddress: transfer.channelAddress,
                amount: withdrawalAmount.toString(),
                assetId,
                fee,
                expiry: quote.expiry,
            };
            const recovered = yield vector_utils_1.recoverAddressFromChannelMessage(vector_utils_1.hashWithdrawalQuote(recreated), quote.signature);
            if (recovered !== channelState.alice) {
                throw new Error(`Got ${recovered} expected ${channelState.alice} on ${vector_utils_1.safeJsonStringify(recreated)}. (Quote: ${vector_utils_1.safeJsonStringify(quote)})`);
            }
        }
        catch (e) {
            yield cancelWithdrawal(`Withdrawal quote recovery failed: ${e.message}`);
            return;
        }
        logger.info({ quote, method, methodId }, "Withdrawal fees verified");
    }
    const commitment = new vector_contracts_1.WithdrawCommitment(channelAddress, alice, bob, balance.to[0], assetId, withdrawalAmount.toString(), nonce, callTo, callData);
    const responderSignature = yield signer.signMessage(commitment.hashToSign());
    yield commitment.addSignatures(initiatorSignature, responderSignature);
    let transactionHash = undefined;
    if (signer.address === alice) {
        logger.info({ method, withdrawalAmount: withdrawalAmount.toString(), channelAddress }, "Submitting withdrawal to chain");
        const withdrawalResponse = yield chainService.sendWithdrawTx(channelState, commitment.getSignedTransaction());
        if (!withdrawalResponse.isError) {
            transactionHash = withdrawalResponse.getValue().hash;
            logger.info({ method, transactionHash }, "Submitted tx");
            evts[vector_types_1.WITHDRAWAL_RECONCILED_EVENT].post({
                aliceIdentifier,
                bobIdentifier,
                channelAddress,
                transferId,
                transactionHash,
            });
        }
        else {
            logger.error({ error: withdrawalResponse.getError().message, method }, "Failed to submit tx");
        }
    }
    commitment.addTransaction(transactionHash);
    yield store.saveWithdrawalCommitment(transfer.transferId, commitment.toJson());
    const resolveMeta = Object.assign({ transactionHash }, (meta !== null && meta !== void 0 ? meta : {}));
    const resolveRes = yield vector.resolve({
        transferResolver: { responderSignature },
        transferId,
        channelAddress,
        meta: resolveMeta,
    });
    if (resolveRes.isError) {
        logger.error({
            method,
            error: resolveRes.getError().message,
            transferId,
            channelAddress,
            transactionHash,
        }, "Failed to resolve");
        return;
    }
    logger.info({ method, amount: withdrawalAmount.toString(), assetId: transfer.assetId, fee }, "Withdrawal resolved");
});
//# sourceMappingURL=listeners.js.map