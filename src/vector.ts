"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.Vector = void 0;
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const evt_1 = require("evt");
const errors_1 = require("./errors");
const sync = __importStar(require("./sync"));
const utils_1 = require("./utils");
class Vector {
    constructor(messagingService, lockService, storeService, signer, chainReader, externalValidationService, logger, skipCheckIn) {
        this.messagingService = messagingService;
        this.lockService = lockService;
        this.storeService = storeService;
        this.signer = signer;
        this.chainReader = chainReader;
        this.externalValidationService = externalValidationService;
        this.logger = logger;
        this.skipCheckIn = skipCheckIn;
        this.evts = {
            [vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT]: evt_1.Evt.create(),
        };
    }
    static connect(messagingService, lockService, storeService, signer, chainReader, logger, skipCheckIn, validationService) {
        return __awaiter(this, void 0, void 0, function* () {
            const externalValidation = validationService !== null && validationService !== void 0 ? validationService : {
                validateOutbound: (params, state, activeTransfers) => Promise.resolve(vector_types_1.Result.ok(undefined)),
                validateInbound: (update, state, activeTransfers) => Promise.resolve(vector_types_1.Result.ok(undefined)),
            };
            const node = yield new Vector(messagingService, lockService, storeService, signer, chainReader, externalValidation, logger, skipCheckIn).setupServices();
            logger.info("Vector Protocol connected 🚀!");
            return node;
        });
    }
    get signerAddress() {
        return this.signer.address;
    }
    get publicIdentifier() {
        return this.signer.publicIdentifier;
    }
    lockedOperation(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const outboundRes = yield sync.outbound(params, this.storeService, this.chainReader, this.messagingService, this.externalValidationService, this.signer, this.logger);
            if (outboundRes.isError) {
                this.logger.error({
                    method: "lockedOperation",
                    variable: "outboundRes",
                    error: vector_types_1.jsonifyError(outboundRes.getError()),
                });
                return outboundRes;
            }
            const { updatedChannel, updatedTransfers, updatedTransfer } = outboundRes.getValue();
            this.evts[vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT].post({
                updatedChannelState: updatedChannel,
                updatedTransfers,
                updatedTransfer,
            });
            return vector_types_1.Result.ok(outboundRes.getValue().updatedChannel);
        });
    }
    executeUpdate(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "executeUpdate";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.debug({
                method,
                methodId,
                step: "start",
                params,
                channelAddress: params.channelAddress,
                updateSender: this.publicIdentifier,
            });
            let aliceIdentifier;
            let bobIdentifier;
            let channel;
            if (params.type === vector_types_1.UpdateType.setup) {
                aliceIdentifier = this.publicIdentifier;
                bobIdentifier = params.details.counterpartyIdentifier;
            }
            else {
                channel = yield this.storeService.getChannelState(params.channelAddress);
                if (!channel) {
                    return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.ChannelNotFound, params));
                }
                aliceIdentifier = channel.aliceIdentifier;
                bobIdentifier = channel.bobIdentifier;
            }
            const isAlice = this.publicIdentifier === aliceIdentifier;
            const counterpartyIdentifier = isAlice ? bobIdentifier : aliceIdentifier;
            let key;
            try {
                key = yield this.lockService.acquireLock(params.channelAddress, isAlice, counterpartyIdentifier);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.AcquireLockFailed, params, channel, {
                    lockError: e.message,
                }));
            }
            const outboundRes = yield this.lockedOperation(params);
            try {
                yield this.lockService.releaseLock(params.channelAddress, key, isAlice, counterpartyIdentifier);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.ReleaseLockFailed, params, channel, {
                    outboundResult: outboundRes.toJson(),
                    lockError: vector_types_1.jsonifyError(e),
                }));
            }
            return outboundRes;
        });
    }
    setupServices() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.messagingService.onReceiveProtocolMessage(this.publicIdentifier, (msg, from, inbox) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (from === this.publicIdentifier) {
                    return;
                }
                const method = "onReceiveProtocolMessage";
                const methodId = vector_utils_1.getRandomBytes32();
                this.logger.debug({ method, methodId }, "Method start");
                if (msg.isError) {
                    this.logger.error({ method, methodId, error: (_a = msg.getError()) === null || _a === void 0 ? void 0 : _a.toJson() }, "Error received from counterparty's initial message, this shouldn't happen");
                    return;
                }
                const received = msg.getValue();
                const keys = Object.keys(received);
                if (!keys.includes("update") || !keys.includes("previousUpdate")) {
                    this.logger.warn({ method, methodId, received: Object.keys(received) }, "Message malformed");
                    return;
                }
                const receivedError = this.validateParamSchema(received.update, vector_types_1.TChannelUpdate);
                if (receivedError) {
                    this.logger.warn({ method, methodId, update: received.update, error: vector_types_1.jsonifyError(receivedError) }, "Received malformed proposed update");
                    return;
                }
                const previousError = this.validateParamSchema(received.previousUpdate, vector_types_1.TChannelUpdate);
                if (previousError && received.previousUpdate) {
                    this.logger.warn({ method, methodId, update: received.previousUpdate, error: vector_types_1.jsonifyError(previousError) }, "Received malformed previous update");
                    return;
                }
                if (received.update.fromIdentifier === this.publicIdentifier) {
                    this.logger.debug({ method, methodId }, "Received update from ourselves, doing nothing");
                    return;
                }
                const inboundRes = yield sync.inbound(received.update, received.previousUpdate, inbox, this.chainReader, this.storeService, this.messagingService, this.externalValidationService, this.signer, this.logger);
                if (inboundRes.isError) {
                    this.logger.warn({ method, methodId, error: vector_types_1.jsonifyError(inboundRes.getError()) }, "Failed to apply inbound update");
                    return;
                }
                const { updatedChannel, updatedActiveTransfers, updatedTransfer } = inboundRes.getValue();
                this.evts[vector_types_1.ProtocolEventName.CHANNEL_UPDATE_EVENT].post({
                    updatedChannelState: updatedChannel,
                    updatedTransfers: updatedActiveTransfers,
                    updatedTransfer,
                });
                this.logger.debug({ method, methodId }, "Method complete");
            }));
            if (!this.skipCheckIn) {
                const channels = yield this.storeService.getChannelStates();
                const providers = this.chainReader.getChainProviders();
                if (providers.isError) {
                    this.logger.error(Object.assign({}, providers.getError()), "Error getting chain providers");
                    return this;
                }
                const supportedChains = Object.keys(providers.getValue()).map((chain) => parseInt(chain));
                yield Promise.all(channels.map((channel) => __awaiter(this, void 0, void 0, function* () {
                    if (!supportedChains.includes(channel.networkContext.chainId)) {
                        this.logger.debug({ chainId: channel.networkContext.chainId, supportedChains }, "Channel chain not supported, skipping");
                        return;
                    }
                    const disputeRes = yield this.chainReader.getChannelDispute(channel.channelAddress, channel.networkContext.chainId);
                    if (disputeRes.isError) {
                        this.logger.error({ channelAddress: channel.channelAddress, error: disputeRes.getError().message }, "Could not get dispute");
                        return;
                    }
                    const dispute = disputeRes.getValue();
                    if (!dispute) {
                        return;
                    }
                    try {
                        yield this.storeService.saveChannelDispute(Object.assign(Object.assign({}, channel), { inDispute: true }), dispute);
                    }
                    catch (e) {
                        this.logger.error({ channelAddress: channel.channelAddress, error: e.message }, "Failed to update dispute on startup");
                    }
                })));
            }
            else {
                this.logger.warn("Skipping checking disputes because of skipCheckIn config");
            }
            return this;
        });
    }
    validateParamSchema(params, schema) {
        const error = utils_1.validateSchema(params, schema);
        if (error) {
            return new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.InvalidParams, params, undefined, {
                paramsError: error,
            });
        }
        return undefined;
    }
    setup(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "setup";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.debug({ method, methodId }, "Method start");
            const error = this.validateParamSchema(params, vector_types_1.ProtocolParams.SetupSchema);
            if (error) {
                this.logger.error({ method, methodId, params, error: vector_types_1.jsonifyError(error) });
                return vector_types_1.Result.fail(error);
            }
            const create2Res = yield vector_utils_1.getCreate2MultisigAddress(this.publicIdentifier, params.counterpartyIdentifier, params.networkContext.chainId, params.networkContext.channelFactoryAddress, this.chainReader);
            if (create2Res.isError) {
                return vector_types_1.Result.fail(new errors_1.OutboundChannelUpdateError(errors_1.OutboundChannelUpdateError.reasons.Create2Failed, { details: params, channelAddress: "", type: vector_types_1.UpdateType.setup }, undefined, {
                    create2Error: (_a = create2Res.getError()) === null || _a === void 0 ? void 0 : _a.message,
                }));
            }
            const channelAddress = create2Res.getValue();
            const updateParams = {
                channelAddress,
                details: params,
                type: vector_types_1.UpdateType.setup,
            };
            const returnVal = yield this.executeUpdate(updateParams);
            this.logger.debug({
                result: returnVal.isError ? vector_types_1.jsonifyError(returnVal.getError()) : returnVal.getValue(),
                method,
                methodId,
            }, "Method complete");
            return returnVal;
        });
    }
    deposit(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "deposit";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.debug({ method, methodId }, "Method start");
            const error = this.validateParamSchema(params, vector_types_1.ProtocolParams.DepositSchema);
            if (error) {
                return vector_types_1.Result.fail(error);
            }
            const updateParams = {
                channelAddress: params.channelAddress,
                type: vector_types_1.UpdateType.deposit,
                details: params,
            };
            const returnVal = yield this.executeUpdate(updateParams);
            this.logger.debug({
                result: returnVal.isError ? vector_types_1.jsonifyError(returnVal.getError()) : returnVal.getValue(),
                method,
                methodId,
            }, "Method complete");
            return returnVal;
        });
    }
    create(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "create";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.debug({ method, methodId }, "Method start");
            const error = this.validateParamSchema(params, vector_types_1.ProtocolParams.CreateSchema);
            if (error) {
                return vector_types_1.Result.fail(error);
            }
            const updateParams = {
                channelAddress: params.channelAddress,
                type: vector_types_1.UpdateType.create,
                details: params,
            };
            const returnVal = yield this.executeUpdate(updateParams);
            this.logger.debug({
                result: returnVal.isError ? vector_types_1.jsonifyError(returnVal.getError()) : returnVal.getValue(),
                method,
                methodId,
            }, "Method complete");
            return returnVal;
        });
    }
    resolve(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "resolve";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.debug({ method, methodId }, "Method start");
            const error = this.validateParamSchema(params, vector_types_1.ProtocolParams.ResolveSchema);
            if (error) {
                return vector_types_1.Result.fail(error);
            }
            const updateParams = {
                channelAddress: params.channelAddress,
                type: vector_types_1.UpdateType.resolve,
                details: params,
            };
            const returnVal = yield this.executeUpdate(updateParams);
            this.logger.debug({
                result: returnVal.isError ? vector_types_1.jsonifyError(returnVal.getError()) : returnVal.getValue(),
                method,
                methodId,
            }, "Method complete");
            return returnVal;
        });
    }
    getChannelState(channelAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storeService.getChannelState(channelAddress);
        });
    }
    getActiveTransfers(channelAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storeService.getActiveTransfers(channelAddress);
        });
    }
    getChannelStateByParticipants(aliceIdentifier, bobIdentifier, chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storeService.getChannelStateByParticipants(aliceIdentifier, bobIdentifier, chainId);
        });
    }
    getTransferState(transferId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storeService.getTransferState(transferId);
        });
    }
    getChannelStates() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storeService.getChannelStates();
        });
    }
    on(event, callback, filter = (_payload) => true) {
        this.evts[event].pipe(filter).attach(callback);
    }
    once(event, callback, filter = (_payload) => true) {
        this.evts[event].pipe(filter).attachOnce(callback);
    }
    waitFor(event, timeout, filter = (_payload) => true) {
        return this.evts[event].pipe(filter).waitFor(timeout);
    }
    off(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (event) {
                this.evts[event].detach();
                return;
            }
            Object.values(this.evts).forEach((evt) => evt.detach());
            yield this.messagingService.disconnect();
        });
    }
}
exports.Vector = Vector;
//# sourceMappingURL=vector.js.map