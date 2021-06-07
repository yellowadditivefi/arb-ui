"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashWithdrawalQuote = exports.decodeWithdrawalQuote = exports.encodeWithdrawalQuote = exports.hashTransferQuote = exports.decodeTransferQuote = exports.encodeTransferQuote = exports.createlockHash = exports.hashCoreTransferState = exports.hashTransferState = exports.encodeCoreTransferState = exports.encodeTransferResolver = exports.decodeTransferResolver = exports.encodeBalance = exports.encodeTransferState = exports.getTransferId = void 0;
const vector_types_1 = require("@connext/vector-types");
const abi_1 = require("@ethersproject/abi");
const solidity_1 = require("@ethersproject/solidity");
exports.getTransferId = (channelAddress, channelNonce, transferDefinition, transferTimeout) => solidity_1.keccak256(["address", "address", "uint256", "uint256"], [transferDefinition, channelAddress, transferTimeout, channelNonce]);
exports.encodeTransferState = (state, encoding) => abi_1.defaultAbiCoder.encode([encoding], [state]);
exports.encodeBalance = (balance) => abi_1.defaultAbiCoder.encode([vector_types_1.BalanceEncoding], [balance]);
exports.decodeTransferResolver = (encoded, encoding) => abi_1.defaultAbiCoder.decode([encoding], encoded)[0];
exports.encodeTransferResolver = (resolver, encoding) => abi_1.defaultAbiCoder.encode([encoding], [resolver]);
exports.encodeCoreTransferState = (state) => abi_1.defaultAbiCoder.encode([vector_types_1.CoreTransferStateEncoding], [state]);
exports.hashTransferState = (state, encoding) => solidity_1.keccak256(["bytes"], [exports.encodeTransferState(state, encoding)]);
exports.hashCoreTransferState = (state) => solidity_1.keccak256(["bytes"], [exports.encodeCoreTransferState(state)]);
exports.createlockHash = (preImage) => solidity_1.sha256(["bytes32"], [preImage]);
exports.encodeTransferQuote = (quote) => abi_1.defaultAbiCoder.encode([vector_types_1.TransferQuoteEncoding], [quote]);
exports.decodeTransferQuote = (encodedQuote) => {
    const decoded = abi_1.defaultAbiCoder.decode([vector_types_1.TransferQuoteEncoding], encodedQuote)[0];
    return {
        routerIdentifier: decoded.routerIdentifier,
        amount: decoded.amount.toString(),
        assetId: decoded.assetId,
        chainId: decoded.chainId.toNumber(),
        recipient: decoded.recipient,
        recipientChainId: decoded.recipientChainId.toNumber(),
        recipientAssetId: decoded.recipientAssetId,
        fee: decoded.fee.toString(),
        expiry: decoded.expiry.toString(),
    };
};
exports.hashTransferQuote = (quote) => solidity_1.keccak256(["bytes"], [exports.encodeTransferQuote(quote)]);
exports.encodeWithdrawalQuote = (quote) => abi_1.defaultAbiCoder.encode([vector_types_1.WithdrawalQuoteEncoding], [quote]);
exports.decodeWithdrawalQuote = (encodedQuote) => {
    const decoded = abi_1.defaultAbiCoder.decode([vector_types_1.WithdrawalQuoteEncoding], encodedQuote)[0];
    return {
        channelAddress: decoded.channelAddress,
        amount: decoded.amount.toString(),
        assetId: decoded.assetId,
        fee: decoded.fee.toString(),
        expiry: decoded.expiry.toString(),
    };
};
exports.hashWithdrawalQuote = (quote) => solidity_1.keccak256(["bytes"], [exports.encodeWithdrawalQuote(quote)]);
//# sourceMappingURL=transfers.js.map