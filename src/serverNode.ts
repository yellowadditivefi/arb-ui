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
exports.RestServerNodeService = exports.ServerNodeServiceError = void 0;
const vector_types_1 = require("@connext/vector-types");
const ajv_1 = __importDefault(require("ajv"));
const axios_1 = __importDefault(require("axios"));
const evt_1 = require("evt");
const ajv = new ajv_1.default();
class ServerNodeServiceError extends vector_types_1.NodeError {
    constructor(msg, publicIdentifier, requestUrl, params, context = {}) {
        super(msg, Object.assign({ requestUrl, publicIdentifier, params }, context));
        this.msg = msg;
    }
}
exports.ServerNodeServiceError = ServerNodeServiceError;
ServerNodeServiceError.type = "ServerNodeServiceError";
ServerNodeServiceError.reasons = {
    InternalServerError: "Failed to send request",
    InvalidParams: "Request has invalid parameters",
    MultinodeProhibitted: "Not allowed to have multiple nodes",
    NoEvts: "No evts for event",
    NoPublicIdentifier: "Public identifier not supplied, and no default identifier",
    Timeout: "Timeout",
};
class RestServerNodeService {
    constructor(serverNodeUrl, logger, evts) {
        this.serverNodeUrl = serverNodeUrl;
        this.logger = logger;
        this.evts = evts;
        this.publicIdentifier = "";
        this.signerAddress = "";
        this.ctxs = {};
    }
    static connect(serverNodeUrl, logger, evts, index, skipCheckIn) {
        return __awaiter(this, void 0, void 0, function* () {
            const service = new RestServerNodeService(serverNodeUrl, logger, evts);
            if (typeof index === "number") {
                const node = yield service.createNode({ index, skipCheckIn });
                if (node.isError) {
                    logger.error({ error: node.getError().message, method: "connect" }, "Failed to create node");
                    throw node.getError();
                }
                const { publicIdentifier, signerAddress } = node.getValue();
                service.publicIdentifier = publicIdentifier;
                service.signerAddress = signerAddress;
            }
            return service;
        });
    }
    getStatus(publicIdentifer) {
        return this.executeHttpRequest(`${publicIdentifer !== null && publicIdentifer !== void 0 ? publicIdentifer : this.publicIdentifier}/status`, "get", {}, vector_types_1.NodeParams.GetStatusSchema);
    }
    getRouterConfig(params) {
        var _a;
        return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/router/config/${params.routerIdentifier}`, "get", params, vector_types_1.NodeParams.GetRouterConfigSchema);
    }
    getConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("config", "get", {}, vector_types_1.NodeParams.GetConfigSchema);
        });
    }
    sendDisputeChannelTx(params) {
        return this.executeHttpRequest(`send-dispute-channel-tx`, "post", params, vector_types_1.NodeParams.SendDisputeChannelTxSchema);
    }
    sendDefundChannelTx(params) {
        return this.executeHttpRequest(`send-defund-channel-tx`, "post", params, vector_types_1.NodeParams.SendDefundChannelTxSchema);
    }
    sendDisputeTransferTx(params) {
        return this.executeHttpRequest(`send-dispute-transfer-tx`, "post", params, vector_types_1.NodeParams.SendDisputeTransferTxSchema);
    }
    sendDefundTransferTx(params) {
        return this.executeHttpRequest(`send-defund-transfer-tx`, "post", params, vector_types_1.NodeParams.SendDefundTransferTxSchema);
    }
    createNode(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.executeHttpRequest(`node`, "post", params, vector_types_1.NodeParams.CreateNodeSchema);
            if (res.isError) {
                return res;
            }
            if (!this.evts) {
                return res;
            }
            const { publicIdentifier } = res.getValue();
            if (this.ctxs[publicIdentifier]) {
                return res;
            }
            const urls = Object.fromEntries(Object.entries(this.evts).map(([event, config]) => {
                var _a;
                return [event, (_a = config.url) !== null && _a !== void 0 ? _a : ""];
            }));
            this.ctxs[publicIdentifier] = evt_1.Evt.newCtx();
            const subscriptionParams = {
                events: urls,
                publicIdentifier,
            };
            const subscription = yield this.executeHttpRequest(`event/subscribe`, "post", subscriptionParams, vector_types_1.NodeParams.RegisterListenerSchema);
            if (subscription.isError) {
                this.logger.error({ error: subscription.getError(), publicIdentifier }, "Failed to create subscription");
                return vector_types_1.Result.fail(subscription.getError());
            }
            this.logger.info({ urls, method: "createNode", publicIdentifier }, "Engine event subscription created");
            return res;
        });
    }
    getStateChannel(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/channels/${params.channelAddress}`, "get", params, vector_types_1.NodeParams.GetChannelStateSchema);
        });
    }
    getStateChannels(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/channels`, "get", params, vector_types_1.NodeParams.GetChannelStatesSchema);
        });
    }
    getTransfersByRoutingId(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/transfers/routing-id/${params.routingId}`, "get", params, vector_types_1.NodeParams.GetTransferStatesByRoutingIdSchema);
        });
    }
    getTransferByRoutingId(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/channels/${params.channelAddress}/transfers/routing-id/${params.routingId}`, "get", params, vector_types_1.NodeParams.GetTransferStateByRoutingIdSchema);
        });
    }
    getTransfer(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/transfers/${params.transferId}`, "get", params, vector_types_1.NodeParams.GetTransferStateSchema);
        });
    }
    getActiveTransfers(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/channels/${params.channelAddress}/active-transfers`, "get", params, vector_types_1.NodeParams.GetActiveTransfersByChannelAddressSchema);
        });
    }
    getTransfers(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const queryString = [
                params.active ? `active=${params.active}` : undefined,
                params.channelAddress ? `channelAddress=${params.channelAddress}` : undefined,
                params.routingId ? `routingId=${params.routingId}` : undefined,
                params.startDate ? `startDate=${Date.parse(params.startDate.toString())}` : undefined,
                params.endDate ? `endDate=${Date.parse(params.endDate.toString())}` : undefined,
            ]
                .filter((x) => !!x)
                .join("&");
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/transfers?${queryString}`, "get", params, vector_types_1.NodeParams.GetActiveTransfersByChannelAddressSchema);
        });
    }
    getStateChannelByParticipants(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/channels/counterparty/${params.counterparty}/chain-id/${params.chainId}`, "get", params, vector_types_1.NodeParams.GetChannelStateByParticipantsSchema);
        });
    }
    getRegisteredTransfers(params) {
        var _a;
        return this.executeHttpRequest(`${(_a = params.publicIdentifier) !== null && _a !== void 0 ? _a : this.publicIdentifier}/registered-transfers/chain-id/${params.chainId}`, "get", params, vector_types_1.NodeParams.GetRegisteredTransfersSchema);
    }
    restoreState(params) {
        return this.executeHttpRequest(`restore`, "post", params, vector_types_1.NodeParams.RestoreStateSchema);
    }
    setup(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("setup", "post", params, vector_types_1.NodeParams.RequestSetupSchema);
        });
    }
    internalSetup(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("internal-setup", "post", params, vector_types_1.NodeParams.SetupSchema);
        });
    }
    sendDepositTx(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("send-deposit-tx", "post", params, vector_types_1.NodeParams.SendDepositTxSchema);
        });
    }
    reconcileDeposit(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("deposit", "post", {
                channelAddress: params.channelAddress,
                assetId: params.assetId,
                publicIdentifier: params.publicIdentifier,
            }, vector_types_1.NodeParams.DepositSchema);
        });
    }
    requestCollateral(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest("request-collateral", "post", params, vector_types_1.NodeParams.RequestCollateralSchema);
        });
    }
    getTransferQuote(params) {
        return this.executeHttpRequest(`transfers/quote`, "post", params, vector_types_1.NodeParams.TransferQuoteSchema);
    }
    conditionalTransfer(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`transfers/create`, "post", params, vector_types_1.NodeParams.ConditionalTransferSchema);
        });
    }
    resolveTransfer(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHttpRequest(`transfers/resolve`, "post", params, vector_types_1.NodeParams.ResolveTransferSchema);
        });
    }
    withdraw(params) {
        return this.executeHttpRequest(`withdraw`, "post", params, vector_types_1.NodeParams.WithdrawSchema);
    }
    getWithdrawalQuote(params) {
        return this.executeHttpRequest(`withdraw/quote`, "post", params, vector_types_1.NodeParams.WithdrawalQuoteSchema);
    }
    signUtilityMessage(params) {
        return this.executeHttpRequest(`sign-utility-message`, "post", params, vector_types_1.NodeParams.SignUtilityMessageSchema);
    }
    sendIsAliveMessage(params) {
        return this.executeHttpRequest(`is-alive`, "post", params, vector_types_1.NodeParams.SendIsAliveSchema);
    }
    once(event, callback, filter = () => true, publicIdentifier) {
        var _a;
        if (!this.evts || !((_a = this.evts[event]) === null || _a === void 0 ? void 0 : _a.evt)) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoEvts, publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier, "", { event, publicIdentifier });
        }
        const pubId = publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier;
        if (!pubId) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoPublicIdentifier, "", "", {
                event,
                publicIdentifier,
            });
        }
        const ctx = this.ctxs[publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier];
        this.evts[event].evt
            .pipe(ctx)
            .pipe((data) => {
            const filtered = filter(data);
            const toStrip = data;
            const pubIds = [toStrip.publicIdentifier, toStrip.bobIdentifier, toStrip.aliceIdentifier].filter((x) => !!x);
            return filtered && pubIds.includes(pubId);
        })
            .attachOnce(callback);
    }
    on(event, callback, filter = () => true, publicIdentifier) {
        var _a;
        if (!this.evts || !((_a = this.evts[event]) === null || _a === void 0 ? void 0 : _a.evt)) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoEvts, publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier, "", { event, publicIdentifier });
        }
        const pubId = publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier;
        if (!pubId) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoPublicIdentifier, "", "", {
                event,
                publicIdentifier,
            });
        }
        const ctx = this.ctxs[pubId];
        this.evts[event].evt
            .pipe(ctx)
            .pipe((data) => {
            const filtered = filter(data);
            const toStrip = data;
            const pubIds = [toStrip.publicIdentifier, toStrip.bobIdentifier, toStrip.aliceIdentifier].filter((x) => !!x);
            return filtered && pubIds.includes(pubId);
        })
            .attach(callback);
    }
    waitFor(event, timeout, filter = () => true, publicIdentifier) {
        var _a;
        if (!this.evts || !((_a = this.evts[event]) === null || _a === void 0 ? void 0 : _a.evt)) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoEvts, publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier, "", { event, timeout, publicIdentifier });
        }
        const pubId = publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier;
        if (!pubId) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoPublicIdentifier, "", "", {
                event,
                publicIdentifier,
            });
        }
        const ctx = this.ctxs[pubId];
        return this.evts[event].evt
            .pipe(ctx)
            .pipe((data) => {
            const filtered = filter(data);
            const toStrip = data;
            const pubIds = [toStrip.publicIdentifier, toStrip.bobIdentifier, toStrip.aliceIdentifier].filter((x) => !!x);
            return filtered && pubIds.includes(pubId);
        })
            .waitFor(timeout);
    }
    off(event, publicIdentifier) {
        var _a;
        if (!this.evts || !((_a = this.evts[event]) === null || _a === void 0 ? void 0 : _a.evt)) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoEvts, publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier, "", { event, publicIdentifier });
        }
        if (!publicIdentifier && !this.publicIdentifier) {
            throw new ServerNodeServiceError(ServerNodeServiceError.reasons.NoPublicIdentifier, "", "", {
                event,
                publicIdentifier,
            });
        }
        const ctx = this.ctxs[publicIdentifier !== null && publicIdentifier !== void 0 ? publicIdentifier : this.publicIdentifier];
        ctx.done();
    }
    executeHttpRequest(urlPath, method, params, paramSchema) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.serverNodeUrl}/${urlPath}`;
            const validate = ajv.compile(paramSchema);
            const filled = Object.assign({ publicIdentifier: this.publicIdentifier }, params);
            if (!validate(filled)) {
                return vector_types_1.Result.fail(new ServerNodeServiceError(ServerNodeServiceError.reasons.InvalidParams, filled.publicIdentifer, urlPath, params, {
                    paramsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((err) => err.message).join(","),
                }));
            }
            try {
                const res = method === "get" ? yield axios_1.default.get(url) : yield axios_1.default.post(url, filled);
                return vector_types_1.Result.ok(res.data);
            }
            catch (e) {
                const jsonErr = Object.keys(e).includes("toJSON") ? e.toJSON() : e;
                const msg = (_e = (_d = (_c = (_b = e.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) !== null && _d !== void 0 ? _d : jsonErr.message) !== null && _e !== void 0 ? _e : ServerNodeServiceError.reasons.InternalServerError;
                const toThrow = new ServerNodeServiceError(msg.includes("timed out") || msg.includes("timeout") ? ServerNodeServiceError.reasons.Timeout : msg, filled.publicIdentifier, urlPath, params, Object.assign({}, ((_g = (_f = e.response) === null || _f === void 0 ? void 0 : _f.data) !== null && _g !== void 0 ? _g : { stack: (_h = jsonErr.stack) !== null && _h !== void 0 ? _h : "" })));
                return vector_types_1.Result.fail(toThrow);
            }
        });
    }
}
exports.RestServerNodeService = RestServerNodeService;
//# sourceMappingURL=serverNode.js.map