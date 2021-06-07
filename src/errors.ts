"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawQuoteError = exports.RpcError = exports.ParameterConversionError = exports.IsAliveError = exports.RestoreError = exports.CheckInError = exports.DisputeError = void 0;
const vector_types_1 = require("@connext/vector-types");
class DisputeError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, DisputeError.type);
        this.message = message;
    }
}
exports.DisputeError = DisputeError;
DisputeError.type = "DisputeError";
DisputeError.reasons = {
    ChannelDefundTxFailed: "Failed to send defund channel tx",
    ChannelDisputeTxFailed: "Failed to send dispute channel tx",
    ChannelNotInDispute: "Channel is not in dispute",
    ChannelNotFound: "Channel not found",
    CouldNotGetActiveTransfers: "Failed to retrieve active transfers from store",
    CouldNotGetChannel: "Failed to retrieve channel from store",
    CouldNotGetTransfer: "Failed to retrieve transfer from store",
    TransferNotFound: "Transfer not found",
    TransferNotDisputed: "Transfer not in dispute",
    TransferDefundTxFailed: "Failed to send defund transfer tx",
    TransferDisputeTxFailed: "Failed to send dispute transfer tx",
    Unknown: "Unknown dispute error",
};
class CheckInError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, CheckInError.type);
        this.message = message;
    }
}
exports.CheckInError = CheckInError;
CheckInError.type = "CheckInError";
CheckInError.reasons = {
    ChannelNotFound: "Channel not found",
    Unknown: "Unknown check-in error",
};
class RestoreError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, RestoreError.type);
        this.message = message;
    }
}
exports.RestoreError = RestoreError;
RestoreError.type = "RestoreError";
RestoreError.reasons = {
    AckFailed: "Could not send restore ack",
    AcquireLockError: "Failed to acquire restore lock",
    ChannelNotFound: "Channel not found",
    CouldNotGetActiveTransfers: "Failed to retrieve active transfers from store",
    CouldNotGetChannel: "Failed to retrieve channel from store",
    GetChannelAddressFailed: "Failed to calculate channel address for verification",
    InvalidChannelAddress: "Failed to verify channel address",
    InvalidMerkleRoot: "Failed to validate merkleRoot for restoration",
    InvalidSignatures: "Failed to validate sigs on latestUpdate",
    NoData: "No data sent from counterparty to restore",
    ReceivedError: "Got restore error from counterparty",
    ReleaseLockError: "Failed to release restore lock",
    SaveChannelFailed: "Failed to save channel state",
    SyncableState: "Cannot restore, state is syncable. Try reconcileDeposit",
};
class IsAliveError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, IsAliveError.type);
        this.message = message;
    }
}
exports.IsAliveError = IsAliveError;
IsAliveError.type = "IsAliveError";
IsAliveError.reasons = {
    ChannelNotFound: "Channel not found",
    Unknown: "Unknown isAlive error",
};
class ParameterConversionError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, ParameterConversionError.type);
        this.message = message;
    }
}
exports.ParameterConversionError = ParameterConversionError;
ParameterConversionError.type = "ParameterConversionError";
ParameterConversionError.reasons = {
    CannotSendToSelf: "An initiator cannot be a receiver on the same chain",
    CouldNotGetQuote: "Failed to get quote",
    CouldNotSignWithdrawal: "Failed to sign withdrawal commitment",
    FailedToGetRegisteredTransfer: "Could not get transfer registry information",
    FeeGreaterThanAmount: "Fees charged are greater than amount",
    QuoteExpired: "Provided quote has expired",
    NoOp: "Cannot create withdrawal with 0 amount and no call",
    WithdrawToZero: "Cannot withdraw to AddressZero",
};
class RpcError extends vector_types_1.EngineError {
    constructor(message, channelAddress, publicIdentifier, context = {}) {
        super(message, channelAddress, publicIdentifier, context, RpcError.type);
        this.message = message;
    }
}
exports.RpcError = RpcError;
RpcError.type = "RpcError";
RpcError.reasons = {
    ChainServiceFailure: "Failed to execute chain service method",
    ChannelNotFound: "Channel not found",
    DecryptFailed: "Failed to decrypt",
    EngineMethodFailure: "Failed to execute engine method",
    InvalidParams: "Parameters from rpc request are malformed",
    InvalidRpcSchema: "Rpc request is malformed",
    InvalidMethod: "Rpc method is invalid",
    ParamConversionFailed: "Failed to convert engine ",
    ProtocolMethodFailed: "Failed to execute protocol method",
    SignerNotInChannel: "Signer is not in channel",
    StoreMethodFailed: "Failed to execute store method",
    TransferNotFound: "Transfer not found",
    SigningFailed: "Failed to sign message",
    UtilitySigningFailed: "Failed to sign utility message",
};
class WithdrawQuoteError extends vector_types_1.EngineError {
    constructor(message, publicIdentifier, request, context = {}) {
        super(message, request.channelAddress, publicIdentifier, context, WithdrawQuoteError.type);
        this.message = message;
    }
}
exports.WithdrawQuoteError = WithdrawQuoteError;
WithdrawQuoteError.type = "WithdrawQuoteError";
WithdrawQuoteError.reasons = {
    ChannelNotFound: "Channel not found",
    ChainServiceFailure: "Chain service method failed",
    ExchangeRateError: "Calculating exchange failed",
    SignatureFailure: "Signing quote failed",
};
//# sourceMappingURL=errors.js.map