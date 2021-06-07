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
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertWithdrawParams = exports.convertResolveConditionParams = exports.convertConditionalTransferParams = void 0;
const vector_contracts_1 = require("@connext/vector-contracts");
const vector_utils_1 = require("@connext/vector-utils");
const vector_types_1 = require("@connext/vector-types");
const bignumber_1 = require("@ethersproject/bignumber");
const constants_1 = require("@ethersproject/constants");
const address_1 = require("@ethersproject/address");
const errors_1 = require("./errors");
function convertConditionalTransferParams(params, signer, channel, chainReader, messaging) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const { channelAddress, amount, assetId, recipient, details, type, timeout, meta: providedMeta } = params;
        const recipientChainId = (_a = params.recipientChainId) !== null && _a !== void 0 ? _a : channel.networkContext.chainId;
        const recipientAssetId = address_1.getAddress((_b = params.recipientAssetId) !== null && _b !== void 0 ? _b : params.assetId);
        const channelCounterparty = signer.address === channel.alice ? channel.bob : channel.alice;
        if (recipient === signer.publicIdentifier && recipientChainId === channel.networkContext.chainId) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.CannotSendToSelf, channelAddress, signer.publicIdentifier, {
                params,
            }));
        }
        let baseRoutingMeta = undefined;
        if (recipient && vector_utils_1.getSignerAddressFromPublicIdentifier(recipient) !== channelCounterparty) {
            let quote = params.quote;
            if (!quote) {
                const quoteRes = signer.publicIdentifier !== channel.aliceIdentifier
                    ? yield messaging.sendTransferQuoteMessage(vector_types_1.Result.ok({
                        amount: params.amount,
                        assetId: params.assetId,
                        chainId: channel.networkContext.chainId,
                        recipient,
                        recipientChainId,
                        recipientAssetId,
                    }), channel.aliceIdentifier, signer.publicIdentifier)
                    : vector_types_1.Result.ok({
                        signature: undefined,
                        chainId: channel.networkContext.chainId,
                        routerIdentifier: signer.publicIdentifier,
                        amount: params.amount,
                        assetId: params.assetId,
                        recipient,
                        recipientChainId,
                        recipientAssetId,
                        fee: "0",
                        expiry: (Date.now() + 30000).toString(),
                    });
                if (quoteRes.isError) {
                    return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.CouldNotGetQuote, channelAddress, signer.publicIdentifier, { params, quoteError: vector_types_1.jsonifyError(quoteRes.getError()) }));
                }
                quote = quoteRes.getValue();
            }
            const fee = bignumber_1.BigNumber.from(quote.fee);
            if (fee.gte(params.amount)) {
                return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.FeeGreaterThanAmount, channelAddress, signer.publicIdentifier, { quote }));
            }
            const now = Date.now();
            if (parseInt(quote.expiry) <= now) {
                return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.QuoteExpired, channelAddress, signer.publicIdentifier, { params, quote, now }));
            }
            const requireOnline = (_c = providedMeta === null || providedMeta === void 0 ? void 0 : providedMeta.requireOnline) !== null && _c !== void 0 ? _c : true;
            baseRoutingMeta = {
                requireOnline,
                routingId: (_d = providedMeta === null || providedMeta === void 0 ? void 0 : providedMeta.routingId) !== null && _d !== void 0 ? _d : vector_utils_1.getRandomBytes32(),
                path: [{ recipient, recipientChainId, recipientAssetId }],
                quote: Object.assign(Object.assign({}, quote), { routerIdentifier: channel.aliceIdentifier, amount: params.amount, assetId: params.assetId, chainId: channel.networkContext.chainId, recipient,
                    recipientChainId,
                    recipientAssetId }),
            };
        }
        const registryRes = !type.startsWith(`0x`)
            ? yield chainReader.getRegisteredTransferByName(type, channel.networkContext.transferRegistryAddress, channel.networkContext.chainId)
            : yield chainReader.getRegisteredTransferByDefinition(type, channel.networkContext.transferRegistryAddress, channel.networkContext.chainId);
        if (registryRes.isError) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.FailedToGetRegisteredTransfer, channelAddress, signer.publicIdentifier, { params, registryError: vector_types_1.jsonifyError(registryRes.getError()) }));
        }
        const { definition } = registryRes.getValue();
        const transferInitialState = Object.assign({}, details);
        return vector_types_1.Result.ok({
            channelAddress,
            balance: { to: [signer.address, channelCounterparty], amount: [amount.toString(), "0"] },
            assetId,
            transferDefinition: definition,
            transferInitialState,
            timeout: timeout || vector_types_1.DEFAULT_TRANSFER_TIMEOUT.toString(),
            meta: Object.assign(Object.assign({}, (baseRoutingMeta !== null && baseRoutingMeta !== void 0 ? baseRoutingMeta : {})), (providedMeta !== null && providedMeta !== void 0 ? providedMeta : {})),
        });
    });
}
exports.convertConditionalTransferParams = convertConditionalTransferParams;
function convertResolveConditionParams(params, transfer) {
    var _a;
    const { channelAddress, transferResolver, meta } = params;
    return vector_types_1.Result.ok({
        channelAddress,
        transferId: transfer.transferId,
        transferResolver,
        meta: Object.assign(Object.assign({}, ((_a = transfer.meta) !== null && _a !== void 0 ? _a : {})), (meta !== null && meta !== void 0 ? meta : {})),
    });
}
exports.convertResolveConditionParams = convertResolveConditionParams;
function convertWithdrawParams(params, signer, channel, chainAddresses, chainReader, messaging) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channelAddress, callTo, callData, meta } = params;
        const assetId = address_1.getAddress(params.assetId);
        const recipient = address_1.getAddress(params.recipient);
        if (recipient === constants_1.AddressZero) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.WithdrawToZero, channelAddress, signer.publicIdentifier, { params }));
        }
        const noCall = !callTo || callTo === constants_1.AddressZero;
        if (params.amount === "0" && noCall) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.NoOp, channelAddress, signer.publicIdentifier, {
                params,
            }));
        }
        let quote = params.quote;
        if (!quote) {
            const quoteRes = signer.publicIdentifier !== channel.aliceIdentifier
                ? yield messaging.sendWithdrawalQuoteMessage(vector_types_1.Result.ok({ channelAddress: channel.channelAddress, amount: params.amount, assetId: params.assetId }), channel.aliceIdentifier, signer.publicIdentifier)
                : vector_types_1.Result.ok({
                    channelAddress: channel.channelAddress,
                    amount: params.amount,
                    assetId: params.assetId,
                    fee: "0",
                    expiry: (Date.now() + 30000).toString(),
                });
            if (quoteRes.isError) {
                return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.CouldNotGetQuote, channelAddress, signer.publicIdentifier, { params, quoteError: vector_types_1.jsonifyError(quoteRes.getError()) }));
            }
            quote = quoteRes.getValue();
        }
        const fee = bignumber_1.BigNumber.from(quote.fee);
        if (fee.gte(params.amount)) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.FeeGreaterThanAmount, channelAddress, signer.publicIdentifier, { params, quote }));
        }
        const now = Date.now();
        if (parseInt(quote.expiry) <= now) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.QuoteExpired, channelAddress, signer.publicIdentifier, { params, quote, now }));
        }
        const amount = bignumber_1.BigNumber.from(params.amount).sub(fee).toString();
        const commitment = new vector_contracts_1.WithdrawCommitment(channel.channelAddress, channel.alice, channel.bob, params.recipient, assetId, amount.toString(), channel.nonce.toString(), callTo, callData);
        let initiatorSignature;
        try {
            initiatorSignature = yield signer.signMessage(commitment.hashToSign());
        }
        catch (err) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.CouldNotSignWithdrawal, channelAddress, signer.publicIdentifier, {
                signatureError: err.message,
                params,
                commitment: commitment.toJson(),
            }));
        }
        const channelCounterparty = channel.alice === signer.address ? channel.bob : channel.alice;
        const transferInitialState = {
            initiatorSignature,
            initiator: signer.address,
            responder: channelCounterparty,
            data: commitment.hashToSign(),
            nonce: channel.nonce.toString(),
            fee: fee.toString(),
            callTo: callTo !== null && callTo !== void 0 ? callTo : constants_1.AddressZero,
            callData: callData !== null && callData !== void 0 ? callData : "0x",
        };
        const registryRes = yield chainReader.getRegisteredTransferByName(vector_types_1.TransferNames.Withdraw, chainAddresses[channel.networkContext.chainId].transferRegistryAddress, channel.networkContext.chainId);
        if (registryRes.isError) {
            return vector_types_1.Result.fail(new errors_1.ParameterConversionError(errors_1.ParameterConversionError.reasons.FailedToGetRegisteredTransfer, channelAddress, signer.publicIdentifier, { params, registryError: vector_types_1.jsonifyError(registryRes.getError()) }));
        }
        const { definition } = registryRes.getValue();
        return vector_types_1.Result.ok({
            channelAddress,
            balance: {
                amount: [params.amount, "0"],
                to: [recipient, channelCounterparty],
            },
            assetId,
            transferDefinition: definition,
            transferInitialState,
            timeout: vector_types_1.DEFAULT_TRANSFER_TIMEOUT.toString(),
            meta: Object.assign(Object.assign({}, (meta !== null && meta !== void 0 ? meta : {})), { quote: Object.assign(Object.assign({}, quote), { channelAddress,
                    amount, assetId: params.assetId }), withdrawNonce: channel.nonce.toString() }),
        });
    });
}
exports.convertWithdrawParams = convertWithdrawParams;
//# sourceMappingURL=paramConverter.js.map