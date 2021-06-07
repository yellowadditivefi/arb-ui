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
exports.inbound = exports.outbound = void 0;
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const errors_1 = require("./errors");
const utils_1 = require("./utils");
const validate_1 = require("./validate");
function outbound(params, storeService, chainReader, messagingService, externalValidationService, signer, logger) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const method = "outbound";
        const methodId = vector_utils_1.getRandomBytes32();
        logger.debug({ method, methodId }, "Method start");
        const storeRes = yield utils_1.extractContextFromStore(storeService, params.channelAddress);
        if (storeRes.isError) {
            return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.StoreFailure, params, undefined, {
                storeError: (_a = storeRes.getError()) === null || _a === void 0 ? void 0 : _a.message,
                method,
            }));
        }
        let { activeTransfers, channelState: previousState } = storeRes.getValue();
        const updateRes = yield validate_1.validateParamsAndApplyUpdate(signer, chainReader, externalValidationService, params, previousState, activeTransfers, signer.publicIdentifier, logger);
        if (updateRes.isError) {
            logger.warn({ method, methodId, error: vector_types_1.jsonifyError(updateRes.getError()) }, "Failed to apply proposed update");
            return vector_types_1.Result.fail(updateRes.getError());
        }
        let { update, updatedChannel, updatedTransfer, updatedActiveTransfers } = updateRes.getValue();
        logger.debug({
            method,
            channel: updatedChannel.channelAddress,
            transfer: updatedTransfer === null || updatedTransfer === void 0 ? void 0 : updatedTransfer.transferId,
            type: params.type,
        }, "Generated update");
        logger.debug({ method, methodId, to: update.toIdentifier, type: update.type }, "Sending protocol message");
        let counterpartyResult = yield messagingService.sendProtocolMessage(update, previousState === null || previousState === void 0 ? void 0 : previousState.latestUpdate);
        let error = counterpartyResult.getError();
        if (error && error.message === errors_1.InboundChannelUpdateError.reasons.StaleUpdate) {
            logger.warn({
                method,
                methodId,
                proposed: update.nonce,
                error: vector_types_1.jsonifyError(error),
            }, `Behind, syncing and retrying`);
            const syncedResult = yield syncStateAndRecreateUpdate(error, params, previousState, activeTransfers, storeService, chainReader, externalValidationService, signer, logger);
            if (syncedResult.isError) {
                logger.error({ method, methodId, error: vector_types_1.jsonifyError(syncedResult.getError()) }, "Error syncing channel");
                return vector_types_1.Result.fail(syncedResult.getError());
            }
            const sync = syncedResult.getValue();
            counterpartyResult = yield messagingService.sendProtocolMessage(sync.update, sync.updatedChannel.latestUpdate);
            error = counterpartyResult.getError();
            previousState = sync.syncedChannel;
            update = sync.update;
            updatedChannel = sync.updatedChannel;
            updatedTransfer = sync.updatedTransfer;
            updatedActiveTransfers = sync.updatedActiveTransfers;
        }
        if (error) {
            logger.error({ method, methodId, error: vector_types_1.jsonifyError(error) }, "Error receiving response, will not save state!");
            return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(error.message === vector_types_1.MessagingError.reasons.Timeout
                ? errors_1.OutboundChannelUpdateError.reasons.CounterpartyOffline
                : errors_1.OutboundChannelUpdateError.reasons.CounterpartyFailure, params, previousState, {
                counterpartyError: vector_types_1.jsonifyError(error),
            }));
        }
        logger.debug({ method, methodId, to: update.toIdentifier, type: update.type }, "Received protocol response");
        const { update: counterpartyUpdate } = counterpartyResult.getValue();
        const sigRes = yield utils_1.validateChannelSignatures(updatedChannel, counterpartyUpdate.aliceSignature, counterpartyUpdate.bobSignature, "both", logger);
        if (sigRes.isError) {
            const error = new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.BadSignatures, params, previousState, { recoveryError: (_b = sigRes.getError()) === null || _b === void 0 ? void 0 : _b.message });
            logger.error({ method, error: vector_types_1.jsonifyError(error) }, "Error receiving response, will not save state!");
            return vector_types_1.Result.fail(error);
        }
        try {
            yield storeService.saveChannelState(Object.assign(Object.assign({}, updatedChannel), { latestUpdate: counterpartyUpdate }), updatedTransfer);
            logger.debug({ method, methodId }, "Method complete");
            return vector_types_1.Result.ok({
                updatedChannel: Object.assign(Object.assign({}, updatedChannel), { latestUpdate: counterpartyUpdate }),
                updatedTransfers: updatedActiveTransfers,
                updatedTransfer,
            });
        }
        catch (e) {
            return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.SaveChannelFailed, params, Object.assign(Object.assign({}, updatedChannel), { latestUpdate: counterpartyUpdate }), {
                saveChannelError: e.message,
            }));
        }
    });
}
exports.outbound = outbound;
function inbound(update, previousUpdate, inbox, chainReader, storeService, messagingService, externalValidation, signer, logger) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const method = "inbound";
        const methodId = vector_utils_1.getRandomBytes32();
        logger.debug({ method, methodId }, "Method start");
        const returnError = (reason, prevUpdate = update, state, context = {}) => __awaiter(this, void 0, void 0, function* () {
            logger.error({ method, methodId, channel: update.channelAddress, error: reason, context }, "Error responding to channel update");
            const error = new errors_1.InboundChannelUpdateError(reason, prevUpdate, state, context);
            yield messagingService.respondWithProtocolError(inbox, error);
            return vector_types_1.Result.fail(error);
        });
        const storeRes = yield utils_1.extractContextFromStore(storeService, update.channelAddress);
        if (storeRes.isError) {
            return returnError(errors_1.InboundChannelUpdateError.reasons.StoreFailure, undefined, undefined, {
                storeError: (_a = storeRes.getError()) === null || _a === void 0 ? void 0 : _a.message,
            });
        }
        let { activeTransfers, channelState: channelFromStore } = storeRes.getValue();
        const prevNonce = (_b = channelFromStore === null || channelFromStore === void 0 ? void 0 : channelFromStore.nonce) !== null && _b !== void 0 ? _b : 0;
        const diff = update.nonce - prevNonce;
        if (diff <= 0) {
            return returnError(errors_1.InboundChannelUpdateError.reasons.StaleUpdate, channelFromStore.latestUpdate, channelFromStore);
        }
        if (diff >= 3) {
            return returnError(errors_1.InboundChannelUpdateError.reasons.RestoreNeeded, update, channelFromStore, {
                counterpartyLatestUpdate: previousUpdate,
                ourLatestNonce: prevNonce,
            });
        }
        let previousState = channelFromStore ? Object.assign({}, channelFromStore) : undefined;
        if (diff === 2) {
            if (!previousUpdate) {
                return returnError(errors_1.InboundChannelUpdateError.reasons.StaleChannel, previousUpdate, previousState);
            }
            const syncRes = yield syncState(previousUpdate, previousState, activeTransfers, (message) => vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(message !== errors_1.InboundChannelUpdateError.reasons.CannotSyncSetup
                ? errors_1.InboundChannelUpdateError.reasons.SyncFailure
                : errors_1.InboundChannelUpdateError.reasons.CannotSyncSetup, previousUpdate, previousState, {
                syncError: message,
            })), storeService, chainReader, externalValidation, signer, logger);
            if (syncRes.isError) {
                const error = syncRes.getError();
                return returnError(error.message, error.context.update, error.context.state, error.context);
            }
            const { updatedChannel: syncedChannel, updatedActiveTransfers: syncedActiveTransfers } = syncRes.getValue();
            previousState = syncedChannel;
            activeTransfers = syncedActiveTransfers;
        }
        const validateRes = yield validate_1.validateAndApplyInboundUpdate(chainReader, externalValidation, signer, update, previousState, activeTransfers, logger);
        if (validateRes.isError) {
            const _d = (_c = validateRes.getError()) === null || _c === void 0 ? void 0 : _c.context, { state: errState, params: errParams, update: errUpdate } = _d, usefulContext = __rest(_d, ["state", "params", "update"]);
            return returnError(validateRes.getError().message, update, previousState, usefulContext);
        }
        const { updatedChannel, updatedActiveTransfers, updatedTransfer } = validateRes.getValue();
        try {
            yield storeService.saveChannelState(updatedChannel, updatedTransfer);
        }
        catch (e) {
            return returnError(errors_1.InboundChannelUpdateError.reasons.SaveChannelFailed, update, previousState, {
                saveChannelError: e.message,
            });
        }
        yield messagingService.respondToProtocolMessage(inbox, updatedChannel.latestUpdate, previousState ? previousState.latestUpdate : undefined);
        return vector_types_1.Result.ok({ updatedActiveTransfers, updatedChannel, updatedTransfer });
    });
}
exports.inbound = inbound;
const syncStateAndRecreateUpdate = (receivedError, attemptedParams, previousState, activeTransfers, storeService, chainReader, externalValidationService, signer, logger) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const counterpartyUpdate = receivedError.context.update;
    if (!counterpartyUpdate) {
        return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.NoUpdateToSync, attemptedParams, previousState, { receivedError: vector_types_1.jsonifyError(receivedError) }));
    }
    const diff = counterpartyUpdate.nonce - ((_a = previousState === null || previousState === void 0 ? void 0 : previousState.nonce) !== null && _a !== void 0 ? _a : 0);
    if (diff !== 1) {
        return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.RestoreNeeded, attemptedParams, previousState, {
            counterpartyUpdate,
            latestNonce: previousState.nonce,
        }));
    }
    const syncRes = yield syncState(counterpartyUpdate, previousState, activeTransfers, (message) => vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(message !== errors_1.InboundChannelUpdateError.reasons.CannotSyncSetup
        ? errors_1.OutboundChannelUpdateError.reasons.SyncFailure
        : errors_1.OutboundChannelUpdateError.reasons.CannotSyncSetup, attemptedParams, previousState, {
        syncError: message,
    })), storeService, chainReader, externalValidationService, signer, logger);
    if (syncRes.isError) {
        return vector_types_1.Result.fail(syncRes.getError());
    }
    const { updatedChannel: syncedChannel, updatedActiveTransfers: syncedActiveTransfers } = syncRes.getValue();
    const validationRes = yield validate_1.validateParamsAndApplyUpdate(signer, chainReader, externalValidationService, attemptedParams, syncedChannel, syncedActiveTransfers, signer.publicIdentifier, logger);
    if (validationRes.isError) {
        const _c = (_b = validationRes.getError()) === null || _b === void 0 ? void 0 : _b.context, { state: errState, params: errParams, update: errUpdate } = _c, usefulContext = __rest(_c, ["state", "params", "update"]);
        return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.RegenerateUpdateFailed, attemptedParams, syncedChannel, {
            regenerateUpdateError: validationRes.getError().message,
            regenerateUpdateContext: usefulContext,
        }));
    }
    return vector_types_1.Result.ok(Object.assign(Object.assign({}, validationRes.getValue()), { syncedChannel }));
});
const syncState = (toSync, previousState, activeTransfers, handleError, storeService, chainReader, externalValidation, signer, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (toSync.type === vector_types_1.UpdateType.setup) {
        return handleError(errors_1.InboundChannelUpdateError.reasons.CannotSyncSetup);
    }
    if (!toSync.aliceSignature || !toSync.bobSignature) {
        return handleError("Cannot sync single signed state");
    }
    const validateRes = yield validate_1.validateAndApplyInboundUpdate(chainReader, externalValidation, signer, toSync, previousState, activeTransfers, logger);
    if (validateRes.isError) {
        return handleError(validateRes.getError().message);
    }
    const { updatedChannel: syncedChannel, updatedTransfer } = validateRes.getValue();
    try {
        yield storeService.saveChannelState(syncedChannel, updatedTransfer);
    }
    catch (e) {
        return handleError(e.message);
    }
    return vector_types_1.Result.ok(validateRes.getValue());
});
//# sourceMappingURL=sync.js.map