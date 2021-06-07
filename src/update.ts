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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndApplyUpdate = exports.applyUpdate = void 0;
const vector_utils_1 = require("@connext/vector-utils");
const vector_types_1 = require("@connext/vector-types");
const address_1 = require("@ethersproject/address");
const constants_1 = require("@ethersproject/constants");
const errors_1 = require("./errors");
const utils_1 = require("./utils");
function applyUpdate(update, previousState, previousActiveTransfers, finalTransferBalance) {
    var _a, _b;
    const { type, details, channelAddress, fromIdentifier, toIdentifier, balance, assetId, nonce } = update;
    const assetIdx = ((_a = previousState === null || previousState === void 0 ? void 0 : previousState.assetIds) !== null && _a !== void 0 ? _a : []).findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
    if (!previousState && type !== vector_types_1.UpdateType.setup) {
        return vector_types_1.Result.fail(new errors_1.ApplyUpdateError(errors_1.ApplyUpdateError.reasons.ChannelNotFound, update, previousState));
    }
    if (!finalTransferBalance && type === vector_types_1.UpdateType.resolve) {
        return vector_types_1.Result.fail(new errors_1.ApplyUpdateError(errors_1.ApplyUpdateError.reasons.MissingFinalBalance, update, previousState));
    }
    switch (type) {
        case vector_types_1.UpdateType.setup: {
            const { timeout, networkContext } = details;
            return vector_types_1.Result.ok({
                updatedActiveTransfers: [...previousActiveTransfers],
                updatedChannel: {
                    nonce: 1,
                    channelAddress,
                    timeout,
                    alice: vector_utils_1.getSignerAddressFromPublicIdentifier(fromIdentifier),
                    bob: vector_utils_1.getSignerAddressFromPublicIdentifier(toIdentifier),
                    balances: [],
                    processedDepositsA: [],
                    processedDepositsB: [],
                    assetIds: [],
                    defundNonces: [],
                    merkleRoot: constants_1.HashZero,
                    latestUpdate: update,
                    networkContext,
                    aliceIdentifier: fromIdentifier,
                    bobIdentifier: toIdentifier,
                    inDispute: false,
                },
            });
        }
        case vector_types_1.UpdateType.deposit: {
            const { totalDepositsAlice, totalDepositsBob } = details;
            const balances = reconcileBalanceWithExisting(balance, assetId, previousState.balances, previousState.assetIds);
            const { processedDepositsA, processedDepositsB } = reconcileProcessedDepositsWithExisting(previousState.processedDepositsA, previousState.processedDepositsB, totalDepositsAlice, totalDepositsBob, assetId, previousState.assetIds);
            const updatedChannel = Object.assign(Object.assign({}, previousState), { balances,
                processedDepositsA,
                processedDepositsB, assetIds: assetIdx !== -1 ? previousState.assetIds : [...previousState.assetIds, assetId], defundNonces: assetIdx !== -1 ? [...previousState.defundNonces] : [...previousState.defundNonces, "1"], nonce, latestUpdate: update });
            return vector_types_1.Result.ok({
                updatedActiveTransfers: [...previousActiveTransfers],
                updatedChannel: utils_1.mergeAssetIds(updatedChannel),
            });
        }
        case vector_types_1.UpdateType.create: {
            const { merkleRoot, transferInitialState, transferDefinition, transferTimeout, meta, transferId, balance: transferBalance, transferEncodings, } = details;
            const balances = reconcileBalanceWithExisting(balance, assetId, previousState.balances, previousState.assetIds);
            const updatedChannel = Object.assign(Object.assign({}, previousState), { balances,
                nonce,
                merkleRoot, latestUpdate: update });
            const initiator = vector_utils_1.getSignerAddressFromPublicIdentifier(update.fromIdentifier);
            const createdTransfer = {
                balance: transferBalance,
                assetId,
                transferId,
                channelAddress,
                transferDefinition,
                transferEncodings,
                transferTimeout,
                initialStateHash: vector_utils_1.hashTransferState(transferInitialState, transferEncodings[0]),
                transferState: transferInitialState,
                channelFactoryAddress: previousState.networkContext.channelFactoryAddress,
                chainId: previousState.networkContext.chainId,
                transferResolver: undefined,
                initiator,
                responder: initiator === previousState.alice ? previousState.bob : previousState.alice,
                meta: Object.assign(Object.assign({}, (meta !== null && meta !== void 0 ? meta : {})), { createdAt: Date.now() }),
                inDispute: false,
                channelNonce: previousState.nonce,
                initiatorIdentifier: update.fromIdentifier,
                responderIdentifier: update.toIdentifier,
            };
            return vector_types_1.Result.ok({
                updatedChannel,
                updatedTransfer: createdTransfer,
                updatedActiveTransfers: [...previousActiveTransfers, createdTransfer],
            });
        }
        case vector_types_1.UpdateType.resolve: {
            const { merkleRoot, transferId, transferResolver, meta } = details;
            const transfer = previousActiveTransfers.find((t) => t.transferId === transferId);
            if (!transfer) {
                return vector_types_1.Result.fail(new errors_1.ApplyUpdateError(errors_1.ApplyUpdateError.reasons.TransferNotActive, update, previousState));
            }
            const balances = reconcileBalanceWithExisting(balance, assetId, previousState.balances, previousState.assetIds);
            const updatedChannel = Object.assign(Object.assign({}, previousState), { balances,
                nonce,
                merkleRoot, latestUpdate: update });
            const resolvedTransfer = Object.assign(Object.assign({}, transfer), { transferState: Object.assign(Object.assign({}, transfer.transferState), { balance: Object.assign({}, finalTransferBalance) }), transferResolver: Object.assign({}, transferResolver), meta: Object.assign(Object.assign(Object.assign({}, ((_b = transfer.meta) !== null && _b !== void 0 ? _b : {})), (meta !== null && meta !== void 0 ? meta : {})), { resolvedAt: Date.now() }) });
            return vector_types_1.Result.ok({
                updatedChannel,
                updatedTransfer: resolvedTransfer,
                updatedActiveTransfers: previousActiveTransfers.filter((t) => t.transferId !== transferId),
            });
        }
        default: {
            return vector_types_1.Result.fail(new errors_1.ApplyUpdateError(errors_1.ApplyUpdateError.reasons.BadUpdateType, update, previousState));
        }
    }
}
exports.applyUpdate = applyUpdate;
function generateAndApplyUpdate(signer, chainReader, params, previousState, activeTransfers, initiatorIdentifier, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        let proposedUpdate;
        let finalTransferBalance = undefined;
        switch (params.type) {
            case vector_types_1.UpdateType.setup: {
                proposedUpdate = generateSetupUpdate(params, initiatorIdentifier);
                break;
            }
            case vector_types_1.UpdateType.deposit: {
                const depositRes = yield generateDepositUpdate(previousState, params, signer, chainReader, initiatorIdentifier);
                if (depositRes.isError) {
                    return vector_types_1.Result.fail(depositRes.getError());
                }
                proposedUpdate = depositRes.getValue();
                break;
            }
            case vector_types_1.UpdateType.create: {
                const createRes = yield generateCreateUpdate(previousState, params, signer, activeTransfers, chainReader, initiatorIdentifier);
                if (createRes.isError) {
                    return vector_types_1.Result.fail(createRes.getError());
                }
                proposedUpdate = createRes.getValue();
                break;
            }
            case vector_types_1.UpdateType.resolve: {
                const resolveRes = yield generateResolveUpdate(previousState, params, signer, activeTransfers, chainReader, initiatorIdentifier);
                if (resolveRes.isError) {
                    return vector_types_1.Result.fail(resolveRes.getError());
                }
                const resolve = resolveRes.getValue();
                proposedUpdate = resolve.update;
                finalTransferBalance = resolve.transferBalance;
                break;
            }
            default: {
                return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.BadUpdateType, params, previousState));
            }
        }
        const applyUpdateRes = applyUpdate(proposedUpdate, previousState, activeTransfers, finalTransferBalance);
        if (applyUpdateRes.isError) {
            const applyError = applyUpdateRes.getError();
            const _a = applyError.context, { state, params } = _a, res = __rest(_a, ["state", "params"]);
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.CouldNotApplyUpdate, params, state, {
                applyUpdateError: applyError.message,
                applyUpdateContext: res,
            }));
        }
        const { updatedChannel, updatedTransfer, updatedActiveTransfers } = applyUpdateRes.getValue();
        const commitmentRes = yield utils_1.generateSignedChannelCommitment(updatedChannel, signer, undefined, undefined, logger);
        if (commitmentRes.isError) {
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.CouldNotSign, params, previousState, {
                signatureError: commitmentRes.getError().message,
            }));
        }
        const { aliceSignature, bobSignature } = commitmentRes.getValue();
        return vector_types_1.Result.ok({
            update: Object.assign(Object.assign({}, proposedUpdate), { aliceSignature, bobSignature }),
            updatedChannel,
            updatedActiveTransfers,
            updatedTransfer,
        });
    });
}
exports.generateAndApplyUpdate = generateAndApplyUpdate;
function generateSetupUpdate(params, initiatorIdentifier) {
    var _a;
    const publicIdentifiers = [initiatorIdentifier, params.details.counterpartyIdentifier];
    const participants = publicIdentifiers.map(vector_utils_1.getSignerAddressFromPublicIdentifier);
    const unsigned = {
        nonce: 1,
        channelAddress: params.channelAddress,
        type: vector_types_1.UpdateType.setup,
        fromIdentifier: initiatorIdentifier,
        toIdentifier: params.details.counterpartyIdentifier,
        balance: { to: participants, amount: ["0", "0"] },
        details: {
            networkContext: params.details.networkContext,
            timeout: params.details.timeout,
            meta: (_a = params.details.meta) !== null && _a !== void 0 ? _a : {},
        },
        assetId: constants_1.AddressZero,
    };
    return unsigned;
}
function generateDepositUpdate(state, params, signer, chainReader, initiatorIdentifier) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { assetId } = params.details;
        const assetIdx = state.assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
        const existingChannelBalance = assetIdx === -1 ? { to: [state.alice, state.bob], amount: ["0", "0"] } : state.balances[assetIdx];
        const processedDepositsAOfAssetId = assetIdx === -1 ? "0" : state.processedDepositsA[assetIdx];
        const processedDepositsBOfAssetId = assetIdx === -1 ? "0" : state.processedDepositsB[assetIdx];
        const reconcileRes = yield utils_1.reconcileDeposit(state.channelAddress, state.networkContext.chainId, existingChannelBalance, processedDepositsAOfAssetId, processedDepositsBOfAssetId, assetId, chainReader);
        if (reconcileRes.isError) {
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.FailedToReconcileDeposit, params, state, {
                reconcileError: vector_types_1.jsonifyError(reconcileRes.getError()),
            }));
        }
        const { balance, totalDepositsAlice, totalDepositsBob } = reconcileRes.getValue();
        const unsigned = Object.assign(Object.assign({}, generateBaseUpdate(state, params, signer, initiatorIdentifier)), { balance, processedDepositsA: totalDepositsAlice, processedDepositsB: totalDepositsBob, assetId, details: { totalDepositsAlice, totalDepositsBob, meta: (_a = params.details.meta) !== null && _a !== void 0 ? _a : {} } });
        return vector_types_1.Result.ok(unsigned);
    });
}
function generateCreateUpdate(state, params, signer, transfers, chainReader, initiatorIdentifier) {
    return __awaiter(this, void 0, void 0, function* () {
        const { details: { assetId, transferDefinition, timeout, transferInitialState, meta, balance }, } = params;
        const registryRes = yield chainReader.getRegisteredTransferByDefinition(transferDefinition, state.networkContext.transferRegistryAddress, state.networkContext.chainId);
        if (registryRes.isError) {
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.TransferNotRegistered, params, state, {
                registryError: vector_types_1.jsonifyError(registryRes.getError()),
            }));
        }
        const { stateEncoding, resolverEncoding } = registryRes.getValue();
        const initialStateHash = vector_utils_1.hashTransferState(transferInitialState, stateEncoding);
        const counterpartyId = signer.address === state.alice ? state.bobIdentifier : state.aliceIdentifier;
        const counterpartyAddr = signer.address === state.alice ? state.bob : state.alice;
        const transferState = {
            balance,
            assetId,
            transferId: vector_utils_1.getTransferId(state.channelAddress, state.nonce.toString(), transferDefinition, timeout),
            channelAddress: state.channelAddress,
            transferDefinition,
            transferEncodings: [stateEncoding, resolverEncoding],
            transferTimeout: timeout,
            initialStateHash,
            transferState: transferInitialState,
            channelFactoryAddress: state.networkContext.channelFactoryAddress,
            chainId: state.networkContext.chainId,
            transferResolver: undefined,
            initiator: vector_utils_1.getSignerAddressFromPublicIdentifier(initiatorIdentifier),
            responder: signer.publicIdentifier === initiatorIdentifier ? counterpartyAddr : signer.address,
            meta: Object.assign(Object.assign({}, (meta !== null && meta !== void 0 ? meta : {})), { createdAt: Date.now() }),
            inDispute: false,
            channelNonce: state.nonce,
            initiatorIdentifier,
            responderIdentifier: signer.publicIdentifier === initiatorIdentifier ? counterpartyId : signer.address,
        };
        const { proof, root } = vector_utils_1.generateMerkleTreeData([...transfers, transferState], transferState);
        const channelBalance = utils_1.getUpdatedChannelBalance(vector_types_1.UpdateType.create, assetId, balance, state, transferState.initiator);
        const unsigned = Object.assign(Object.assign({}, generateBaseUpdate(state, params, signer, initiatorIdentifier)), { balance: channelBalance, assetId, details: {
                transferId: transferState.transferId,
                transferDefinition,
                transferTimeout: timeout,
                balance,
                transferInitialState,
                transferEncodings: [stateEncoding, resolverEncoding],
                merkleProofData: proof,
                merkleRoot: root,
                meta: Object.assign(Object.assign({}, (meta !== null && meta !== void 0 ? meta : {})), { createdAt: Date.now() }),
            } });
        return vector_types_1.Result.ok(unsigned);
    });
}
function generateResolveUpdate(state, params, signer, transfers, chainService, initiatorIdentifier) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { transferId, transferResolver, meta } = params.details;
        const transferToResolve = transfers.find((x) => x.transferId === transferId);
        if (!transferToResolve) {
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.TransferNotActive, params, state, {
                active: transfers.map((t) => t.transferId),
            }));
        }
        const { root } = vector_utils_1.generateMerkleTreeData(transfers.filter((x) => x.transferId !== transferId));
        const transferBalanceResult = yield chainService.resolve(Object.assign(Object.assign({}, transferToResolve), { transferResolver }), state.networkContext.chainId);
        if (transferBalanceResult.isError) {
            return vector_types_1.Result.fail(new errors_1.CreateUpdateError(errors_1.CreateUpdateError.reasons.FailedToResolveTransferOnchain, params, state, {
                resolveError: vector_types_1.jsonifyError(transferBalanceResult.getError()),
            }));
        }
        const transferBalance = transferBalanceResult.getValue();
        const balance = utils_1.getUpdatedChannelBalance(vector_types_1.UpdateType.resolve, transferToResolve.assetId, transferBalance, state, transferToResolve.initiator);
        const unsigned = Object.assign(Object.assign({}, generateBaseUpdate(state, params, signer, initiatorIdentifier)), { balance, assetId: transferToResolve.assetId, details: {
                transferId,
                transferDefinition: transferToResolve.transferDefinition,
                transferResolver,
                merkleRoot: root,
                meta: Object.assign(Object.assign({}, ((_a = transferToResolve.meta) !== null && _a !== void 0 ? _a : {})), (meta !== null && meta !== void 0 ? meta : {})),
            } });
        return vector_types_1.Result.ok({ update: unsigned, transferBalance });
    });
}
function generateBaseUpdate(state, params, signer, initiatorIdentifier) {
    const isInitiator = signer.publicIdentifier === initiatorIdentifier;
    const counterparty = signer.publicIdentifier === state.bobIdentifier ? state.aliceIdentifier : state.bobIdentifier;
    return {
        nonce: state.nonce + 1,
        channelAddress: state.channelAddress,
        type: params.type,
        fromIdentifier: initiatorIdentifier,
        toIdentifier: isInitiator ? counterparty : signer.publicIdentifier,
    };
}
function reconcileBalanceWithExisting(balanceToReconcile, assetToReconcile, existing, assetIds) {
    const assetIdx = assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetToReconcile));
    if (assetIdx === -1) {
        return [...existing, balanceToReconcile];
    }
    const updated = [...existing];
    updated[assetIdx] = balanceToReconcile;
    return updated;
}
function reconcileProcessedDepositsWithExisting(existingProcessedDepositsA, existingProcessedDepositsB, depositToReconcileA, depositToReconcileB, assetToReconcile, assetIds) {
    const assetIdx = assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetToReconcile));
    if (assetIdx === -1) {
        return {
            processedDepositsA: [...existingProcessedDepositsA, depositToReconcileA],
            processedDepositsB: [...existingProcessedDepositsB, depositToReconcileB],
        };
    }
    const updatedA = [...existingProcessedDepositsA];
    const updatedB = [...existingProcessedDepositsB];
    updatedA[assetIdx] = depositToReconcileA;
    updatedB[assetIdx] = depositToReconcileB;
    return { processedDepositsA: updatedA, processedDepositsB: updatedB };
}
//# sourceMappingURL=update.js.map