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
exports.validateAndApplyInboundUpdate = exports.validateParamsAndApplyUpdate = exports.validateUpdateParams = void 0;
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const address_1 = require("@ethersproject/address");
const bignumber_1 = require("@ethersproject/bignumber");
const errors_1 = require("./errors");
const update_1 = require("./update");
const utils_1 = require("./utils");
function validateUpdateParams(signer, chainReader, params, previousState, activeTransfers, initiatorIdentifier) {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function* () {
        const method = "validateUpdateParams";
        const handleError = (validationError, context = {}) => {
            return vector_types_1.Result.fail(new errors_1.ValidationError(validationError, params, previousState, Object.assign(Object.assign({}, context), { method })));
        };
        if (params.type !== vector_types_1.UpdateType.setup && !previousState) {
            return handleError(errors_1.ValidationError.reasons.ChannelNotFound);
        }
        if ((_a = previousState === null || previousState === void 0 ? void 0 : previousState.inDispute) !== null && _a !== void 0 ? _a : false) {
            return handleError(errors_1.ValidationError.reasons.InDispute);
        }
        const { type, channelAddress, details } = params;
        if (previousState && channelAddress !== previousState.channelAddress) {
            return handleError(errors_1.ValidationError.reasons.InvalidChannelAddress);
        }
        const length = ((_b = previousState === null || previousState === void 0 ? void 0 : previousState.assetIds) !== null && _b !== void 0 ? _b : []).length;
        if (((_c = previousState === null || previousState === void 0 ? void 0 : previousState.defundNonces) !== null && _c !== void 0 ? _c : []).length !== length ||
            ((_d = previousState === null || previousState === void 0 ? void 0 : previousState.balances) !== null && _d !== void 0 ? _d : []).length !== length ||
            ((_e = previousState === null || previousState === void 0 ? void 0 : previousState.processedDepositsA) !== null && _e !== void 0 ? _e : []).length !== length ||
            ((_f = previousState === null || previousState === void 0 ? void 0 : previousState.processedDepositsB) !== null && _f !== void 0 ? _f : []).length !== length) {
            return handleError(errors_1.ValidationError.reasons.InvalidArrayLength);
        }
        switch (type) {
            case vector_types_1.UpdateType.setup: {
                const { counterpartyIdentifier, timeout, networkContext } = details;
                if (previousState) {
                    return handleError(errors_1.ValidationError.reasons.ChannelAlreadySetup);
                }
                const calculated = yield chainReader.getChannelAddress(vector_utils_1.getSignerAddressFromPublicIdentifier(initiatorIdentifier), vector_utils_1.getSignerAddressFromPublicIdentifier(counterpartyIdentifier), networkContext.channelFactoryAddress, networkContext.chainId);
                if (calculated.isError) {
                    return handleError(errors_1.ValidationError.reasons.ChainServiceFailure, {
                        chainServiceMethod: "getChannelAddress",
                        chainServiceError: vector_types_1.jsonifyError(calculated.getError()),
                    });
                }
                if (channelAddress !== calculated.getValue()) {
                    return handleError(errors_1.ValidationError.reasons.InvalidChannelAddress);
                }
                const timeoutBN = bignumber_1.BigNumber.from(timeout);
                if (timeoutBN.lt(vector_types_1.MINIMUM_CHANNEL_TIMEOUT)) {
                    return handleError(errors_1.ValidationError.reasons.ShortChannelTimeout);
                }
                if (timeoutBN.gt(vector_types_1.MAXIMUM_CHANNEL_TIMEOUT)) {
                    return handleError(errors_1.ValidationError.reasons.LongChannelTimeout);
                }
                if (counterpartyIdentifier === initiatorIdentifier) {
                    return handleError(errors_1.ValidationError.reasons.InvalidCounterparty);
                }
                break;
            }
            case vector_types_1.UpdateType.deposit: {
                const { assetId } = details;
                if (!address_1.isAddress(assetId)) {
                    return handleError(errors_1.ValidationError.reasons.InvalidAssetId);
                }
                if (!previousState) {
                    return handleError(errors_1.ValidationError.reasons.ChannelNotFound);
                }
                if (previousState.assetIds.length >= 100) {
                    return handleError(errors_1.ValidationError.reasons.TooManyAssets);
                }
                break;
            }
            case vector_types_1.UpdateType.create: {
                const { balance, assetId, transferDefinition, transferInitialState, timeout, } = details;
                if (!previousState) {
                    return handleError(errors_1.ValidationError.reasons.ChannelNotFound);
                }
                const assetIdx = previousState.assetIds.findIndex((a) => address_1.getAddress(a) === address_1.getAddress(assetId));
                if (assetIdx < 0) {
                    return handleError(errors_1.ValidationError.reasons.AssetNotFound);
                }
                const transferId = vector_utils_1.getTransferId(previousState.channelAddress, previousState.nonce.toString(), transferDefinition, timeout);
                if (activeTransfers.find((t) => t.transferId === transferId)) {
                    return handleError(errors_1.ValidationError.reasons.DuplicateTransferId);
                }
                const isAlice = signer.address === previousState.alice;
                const signerChannelBalance = bignumber_1.BigNumber.from(previousState.balances[assetIdx].amount[isAlice ? 0 : 1]);
                const counterpartyChannelBalance = bignumber_1.BigNumber.from(previousState.balances[assetIdx].amount[isAlice ? 1 : 0]);
                const signerCreated = signer.publicIdentifier === initiatorIdentifier;
                if (signerChannelBalance.lt(balance.amount[signerCreated ? 0 : 1]) ||
                    counterpartyChannelBalance.lt(balance.amount[signerCreated ? 1 : 0])) {
                    return handleError(errors_1.ValidationError.reasons.InsufficientFunds);
                }
                const timeoutBN = bignumber_1.BigNumber.from(timeout);
                if (timeoutBN.gte(previousState.timeout)) {
                    return handleError(errors_1.ValidationError.reasons.TransferTimeoutAboveChannel);
                }
                if (timeoutBN.lt(vector_types_1.MINIMUM_TRANSFER_TIMEOUT)) {
                    return handleError(errors_1.ValidationError.reasons.TransferTimeoutBelowMin);
                }
                if (timeoutBN.gt(vector_types_1.MAXIMUM_TRANSFER_TIMEOUT)) {
                    return handleError(errors_1.ValidationError.reasons.TransferTimeoutAboveMax);
                }
                const validRes = yield chainReader.create(transferInitialState, balance, transferDefinition, previousState.networkContext.transferRegistryAddress, previousState.networkContext.chainId);
                if (validRes.isError) {
                    return handleError(errors_1.ValidationError.reasons.ChainServiceFailure, {
                        chainServiceMethod: "create",
                        chainServiceError: vector_types_1.jsonifyError(validRes.getError()),
                    });
                }
                if (!validRes.getValue()) {
                    return handleError(errors_1.ValidationError.reasons.InvalidInitialState);
                }
                break;
            }
            case vector_types_1.UpdateType.resolve: {
                const { transferId, transferResolver } = details;
                if (!previousState) {
                    return handleError(errors_1.ValidationError.reasons.ChannelNotFound);
                }
                const transfer = activeTransfers.find((t) => t.transferId === transferId);
                if (!transfer) {
                    return handleError(errors_1.ValidationError.reasons.TransferNotActive);
                }
                if (typeof transferResolver !== "object") {
                    return handleError(errors_1.ValidationError.reasons.InvalidResolver);
                }
                if (vector_utils_1.getSignerAddressFromPublicIdentifier(initiatorIdentifier) !== transfer.responder) {
                    return handleError(errors_1.ValidationError.reasons.OnlyResponderCanInitiateResolve);
                }
                if (transfer.transferResolver) {
                    return handleError(errors_1.ValidationError.reasons.TransferResolved);
                }
                break;
            }
            default: {
                return handleError(errors_1.ValidationError.reasons.UnrecognizedType);
            }
        }
        return vector_types_1.Result.ok(undefined);
    });
}
exports.validateUpdateParams = validateUpdateParams;
exports.validateParamsAndApplyUpdate = (signer, chainReader, externalValidation, params, previousState, activeTransfers, initiatorIdentifier, logger) => __awaiter(void 0, void 0, void 0, function* () {
    const validParamsRes = yield validateUpdateParams(signer, chainReader, params, previousState, activeTransfers, initiatorIdentifier);
    if (validParamsRes.isError) {
        const error = validParamsRes.getError();
        const _a = error.context, { state, params } = _a, usefulContext = __rest(_a, ["state", "params"]);
        return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.OutboundValidationFailed, params, previousState, {
            validationError: error.message,
            validationContext: usefulContext,
        }));
    }
    if (initiatorIdentifier === signer.publicIdentifier) {
        const externalRes = yield externalValidation.validateOutbound(params, previousState, activeTransfers);
        if (externalRes.isError) {
            return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.ExternalValidationFailed, params, previousState, {
                externalValidationError: externalRes.getError().message,
            }));
        }
    }
    const updateRes = yield update_1.generateAndApplyUpdate(signer, chainReader, params, previousState, activeTransfers, initiatorIdentifier, logger);
    if (updateRes.isError) {
        const error = updateRes.getError();
        const _b = error.context, { state, params: updateParams } = _b, usefulContext = __rest(_b, ["state", "params"]);
        return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.GenerateUpdateFailed, params, previousState, {
            generateError: error.message,
            generateContext: usefulContext,
        }));
    }
    return vector_types_1.Result.ok(updateRes.getValue());
});
function validateAndApplyInboundUpdate(chainReader, externalValidation, signer, update, previousState, activeTransfers, logger) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return __awaiter(this, void 0, void 0, function* () {
        const invalidUpdate = utils_1.validateSchema(update, vector_types_1.TChannelUpdate);
        if (invalidUpdate) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.MalformedUpdate, update, previousState, {
                updateError: invalidUpdate,
            }));
        }
        const schemas = {
            [vector_types_1.UpdateType.create]: vector_types_1.TCreateUpdateDetails,
            [vector_types_1.UpdateType.setup]: vector_types_1.TSetupUpdateDetails,
            [vector_types_1.UpdateType.deposit]: vector_types_1.TDepositUpdateDetails,
            [vector_types_1.UpdateType.resolve]: vector_types_1.TResolveUpdateDetails,
        };
        const invalid = utils_1.validateSchema(update.details, schemas[update.type]);
        if (invalid) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.MalformedDetails, update, previousState, {
                detailsError: invalid,
            }));
        }
        const expected = ((_a = previousState === null || previousState === void 0 ? void 0 : previousState.nonce) !== null && _a !== void 0 ? _a : 0) + 1;
        if (update.nonce !== expected) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.InvalidUpdateNonce, update, previousState));
        }
        if (update.aliceSignature && update.bobSignature) {
            let finalTransferBalance = undefined;
            if (update.type === vector_types_1.UpdateType.resolve) {
                const transfer = activeTransfers.find((t) => t.transferId === update.details.transferId);
                if (!transfer) {
                    return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.TransferNotActive, update, previousState, {
                        existing: activeTransfers.map((t) => t.transferId),
                    }));
                }
                const transferBalanceResult = yield chainReader.resolve(Object.assign(Object.assign({}, ((_b = transfer) !== null && _b !== void 0 ? _b : {})), { transferResolver: update.details.transferResolver }), previousState.networkContext.chainId);
                if (transferBalanceResult.isError) {
                    return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.CouldNotGetFinalBalance, update, previousState, {
                        chainServiceError: vector_types_1.jsonifyError(transferBalanceResult.getError()),
                    }));
                }
                finalTransferBalance = transferBalanceResult.getValue();
            }
            const applyRes = update_1.applyUpdate(update, previousState, activeTransfers, finalTransferBalance);
            if (applyRes.isError) {
                const _k = (_c = applyRes.getError()) === null || _c === void 0 ? void 0 : _c.context, { state, params, update: errUpdate } = _k, usefulContext = __rest(_k, ["state", "params", "update"]);
                return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.ApplyUpdateFailed, update, previousState, {
                    applyUpdateError: (_d = applyRes.getError()) === null || _d === void 0 ? void 0 : _d.message,
                    applyUpdateContext: usefulContext,
                }));
            }
            const { updatedChannel, updatedActiveTransfers, updatedTransfer } = applyRes.getValue();
            const sigRes = yield utils_1.validateChannelSignatures(updatedChannel, update.aliceSignature, update.bobSignature, "both", logger);
            if (sigRes.isError) {
                return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.BadSignatures, update, previousState, {
                    validateSignatureError: (_e = sigRes.getError()) === null || _e === void 0 ? void 0 : _e.message,
                }));
            }
            return vector_types_1.Result.ok({
                updatedChannel: Object.assign(Object.assign({}, updatedChannel), { latestUpdate: Object.assign(Object.assign({}, updatedChannel.latestUpdate), { aliceSignature: update.aliceSignature, bobSignature: update.bobSignature }) }),
                updatedActiveTransfers,
                updatedTransfer,
            });
        }
        const inboundRes = yield externalValidation.validateInbound(update, previousState, activeTransfers);
        if (inboundRes.isError) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.ExternalValidationFailed, update, previousState, {
                externalValidationError: (_f = inboundRes.getError()) === null || _f === void 0 ? void 0 : _f.message,
            }));
        }
        const params = utils_1.getParamsFromUpdate(update);
        if (params.isError) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.CouldNotGetParams, update, previousState, {
                getParamsError: (_g = params.getError()) === null || _g === void 0 ? void 0 : _g.message,
            }));
        }
        const validRes = yield exports.validateParamsAndApplyUpdate(signer, chainReader, externalValidation, params.getValue(), previousState, activeTransfers, update.fromIdentifier, logger);
        if (validRes.isError) {
            const _l = validRes.getError().context, { state, params } = _l, usefulContext = __rest(_l, ["state", "params"]);
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.ApplyAndValidateInboundFailed, update, previousState, {
                validationError: validRes.getError().message,
                validationContext: usefulContext,
            }));
        }
        const { updatedChannel, updatedActiveTransfers, updatedTransfer } = validRes.getValue();
        const sigRes = yield utils_1.validateChannelSignatures(updatedChannel, update.aliceSignature, update.bobSignature, signer.address === updatedChannel.bob ? "alice" : "bob", logger);
        if (sigRes.isError) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.BadSignatures, update, previousState, {
                signatureError: (_h = sigRes.getError()) === null || _h === void 0 ? void 0 : _h.message,
            }));
        }
        const signedRes = yield utils_1.generateSignedChannelCommitment(updatedChannel, signer, update.aliceSignature, update.bobSignature, logger);
        if (signedRes.isError) {
            return vector_types_1.Result.fail(new errors_1.InboundChannelUpdateError(errors_1.InboundChannelUpdateError.reasons.GenerateSignatureFailed, update, previousState, {
                signatureError: (_j = signedRes.getError()) === null || _j === void 0 ? void 0 : _j.message,
            }));
        }
        const signed = signedRes.getValue();
        const signedNextState = Object.assign(Object.assign({}, updatedChannel), { latestUpdate: Object.assign(Object.assign({}, updatedChannel.latestUpdate), { aliceSignature: signed.aliceSignature, bobSignature: signed.bobSignature }) });
        return vector_types_1.Result.ok({ updatedChannel: signedNextState, updatedActiveTransfers, updatedTransfer });
    });
}
exports.validateAndApplyInboundUpdate = validateAndApplyInboundUpdate;
//# sourceMappingURL=validate.js.map