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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorEngine = exports.ajv = void 0;
const vector_protocol_1 = require("@connext/vector-protocol");
const vector_contracts_1 = require("@connext/vector-contracts");
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
const ajv_1 = __importDefault(require("ajv"));
const package_json_1 = require("../package.json");
const errors_1 = require("./errors");
const paramConverter_1 = require("./paramConverter");
const listeners_1 = require("./listeners");
const utils_1 = require("./utils");
const isAlive_1 = require("./isAlive");
exports.ajv = new ajv_1.default();
class VectorEngine {
    constructor(signer, messaging, store, vector, chainService, chainAddresses, lockService, logger) {
        this.signer = signer;
        this.messaging = messaging;
        this.store = store;
        this.vector = vector;
        this.chainService = chainService;
        this.chainAddresses = chainAddresses;
        this.lockService = lockService;
        this.logger = logger;
        this.evts = utils_1.getEngineEvtContainer();
        this.restoreLocks = {};
    }
    static connect(messaging, lock, store, signer, chainService, chainAddresses, logger, skipCheckIn, gasSubsidyPercentage, validationService) {
        return __awaiter(this, void 0, void 0, function* () {
            const vector = yield vector_protocol_1.Vector.connect(messaging, lock, store, signer, chainService, logger.child({ module: "VectorProtocol" }), skipCheckIn, validationService);
            const engine = new VectorEngine(signer, messaging, store, vector, chainService, chainAddresses, lock, logger.child({ module: "VectorEngine" }));
            yield engine.setupListener(gasSubsidyPercentage);
            logger.debug({}, "Setup engine listeners");
            if (!skipCheckIn) {
                isAlive_1.sendIsAlive(engine.signer, engine.messaging, engine.store, engine.chainService, engine.logger);
            }
            else {
                logger.warn("Skipping isAlive broadcast because of skipCheckIn config");
            }
            logger.info({ vector: vector.publicIdentifier }, "Vector Engine connected 🚀!");
            return engine;
        });
    }
    get publicIdentifier() {
        return this.vector.publicIdentifier;
    }
    get signerAddress() {
        return this.vector.signerAddress;
    }
    setupListener(gasSubsidyPercentage) {
        return __awaiter(this, void 0, void 0, function* () {
            yield listeners_1.setupEngineListeners(this.evts, this.chainService, this.vector, this.messaging, this.signer, this.store, this.chainAddresses, this.logger, this.setup.bind(this), this.acquireRestoreLocks.bind(this), this.releaseRestoreLocks.bind(this), gasSubsidyPercentage);
        });
    }
    acquireRestoreLocks(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.restoreLocks[channel.channelAddress]) {
                return vector_types_1.Result.ok(this.restoreLocks[channel.channelAddress]);
            }
            try {
                const isAlice = channel.alice === this.signer.address;
                const lockVal = yield this.lockService.acquireLock(channel.channelAddress, isAlice, isAlice ? channel.bobIdentifier : channel.aliceIdentifier);
                this.restoreLocks[channel.channelAddress] = lockVal;
                return vector_types_1.Result.ok(undefined);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RestoreError(errors_1.RestoreError.reasons.AcquireLockError, channel.channelAddress, this.signer.publicIdentifier, {
                    acquireRestoreLockError: e.message,
                }));
            }
        });
    }
    releaseRestoreLocks(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.restoreLocks[channel.channelAddress]) {
                return vector_types_1.Result.ok(undefined);
            }
            try {
                const isAlice = channel.alice === this.signer.address;
                yield this.lockService.releaseLock(channel.channelAddress, this.restoreLocks[channel.channelAddress], isAlice, isAlice ? channel.bobIdentifier : channel.aliceIdentifier);
                delete this.restoreLocks[channel.channelAddress];
                return vector_types_1.Result.ok(undefined);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RestoreError(errors_1.RestoreError.reasons.ReleaseLockError, channel.channelAddress, this.signer.publicIdentifier, {
                    releaseRestoreLockError: e.message,
                }));
            }
        });
    }
    getConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            return vector_types_1.Result.ok([
                {
                    index: 0,
                    publicIdentifier: this.publicIdentifier,
                    signerAddress: this.signerAddress,
                    chainAddresses: this.chainAddresses,
                },
            ]);
        });
    }
    getTransferQuote(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetTransferQuoteSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const { routerIdentifier } = params, message = __rest(params, ["routerIdentifier"]);
            return this.messaging.sendTransferQuoteMessage(vector_types_1.Result.ok(message), routerIdentifier, this.publicIdentifier);
        });
    }
    getWithdrawalQuote(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetWithdrawalQuoteSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channelRes = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channelRes.isError) {
                return vector_types_1.Result.fail(channelRes.getError());
            }
            const channel = channelRes.getValue();
            if (!channel) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            if (this.publicIdentifier === channel.aliceIdentifier) {
                try {
                    const quote = {
                        channelAddress: params.channelAddress,
                        amount: params.amount,
                        assetId: params.assetId,
                        fee: "0",
                        expiry: (Date.now() + 30000).toString(),
                    };
                    const signature = yield this.signer.signMessage(vector_utils_1.hashWithdrawalQuote(quote));
                    return vector_types_1.Result.ok(Object.assign(Object.assign({}, quote), { signature }));
                }
                catch (e) {
                    return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.SigningFailed, params.channelAddress, this.publicIdentifier, {
                        signingError: vector_types_1.jsonifyError(e),
                    }));
                }
            }
            return this.messaging.sendWithdrawalQuoteMessage(vector_types_1.Result.ok(params), channel.aliceIdentifier, this.publicIdentifier);
        });
    }
    getRouterConfig(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetRouterConfigSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            return this.messaging.sendRouterConfigMessage(vector_types_1.Result.ok(undefined), params.routerIdentifier, this.publicIdentifier);
        });
    }
    getStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const chainIds = Object.keys(this.chainAddresses).map((chainId) => parseInt(chainId));
            const providerResponses = yield Promise.all(chainIds.map((chainId) => this.chainService.getSyncing(chainId)));
            const providerSyncing = Object.fromEntries(chainIds.map((chainId, index) => {
                var _a;
                const res = providerResponses[index];
                let syncing;
                if (res.isError) {
                    syncing = (_a = res.getError()) === null || _a === void 0 ? void 0 : _a.message;
                }
                else {
                    syncing = res.getValue();
                }
                return [chainId, syncing];
            }));
            return vector_types_1.Result.ok({
                version: package_json_1.version,
                publicIdentifier: this.publicIdentifier,
                signerAddress: this.signerAddress,
                providerSyncing,
            });
        });
    }
    getChannelState(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetChannelStateSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const channel = yield this.store.getChannelState(params.channelAddress);
                return vector_types_1.Result.ok(channel);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, params.channelAddress, this.publicIdentifier, {
                    storeMethod: "getChannelState",
                    storeError: e.message,
                    params,
                }));
            }
        });
    }
    getTransferState(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetTransferStateSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const transfer = yield this.store.getTransferState(params.transferId);
                return vector_types_1.Result.ok(transfer);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, "", this.publicIdentifier, {
                    storeMethod: "getTransferState",
                    storeError: e.message,
                    params,
                }));
            }
        });
    }
    getActiveTransfers(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetActiveTransfersSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const transfers = yield this.store.getActiveTransfers(params.channelAddress);
                return vector_types_1.Result.ok(transfers);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, params.channelAddress, this.publicIdentifier, {
                    storeMethod: "getActiveTransfers",
                    storeError: e.message,
                }));
            }
        });
    }
    getTransfers(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetTransfersSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const transfers = yield this.store.getTransfers(params);
                return vector_types_1.Result.ok(transfers);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, "", this.publicIdentifier, {
                    storeMethod: "getTransfers",
                    storeError: e.message,
                }));
            }
        });
    }
    getTransferStateByRoutingId(params) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetTransferStateByRoutingIdSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const transfer = yield this.store.getTransferByRoutingId(params.channelAddress, params.routingId);
                return vector_types_1.Result.ok(transfer);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, (_c = params.channelAddress) !== null && _c !== void 0 ? _c : "", this.publicIdentifier, {
                    storeMethod: "getTransferByRoutingId",
                    storeError: e.message,
                }));
            }
        });
    }
    getTransferStatesByRoutingId(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetTransferStatesByRoutingIdSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const transfers = yield this.store.getTransfersByRoutingId(params.routingId);
                return vector_types_1.Result.ok(transfers);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, "", this.publicIdentifier, {
                    storeMethod: "getTransfersByRoutingId",
                    storeError: e.message,
                }));
            }
        });
    }
    getChannelStateByParticipants(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetChannelStateByParticipantsSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const channel = yield this.store.getChannelStateByParticipants(params.alice, params.bob, params.chainId);
                return vector_types_1.Result.ok(channel);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, "", this.publicIdentifier, {
                    storeMethod: "getChannelStateByParticipants",
                    storeError: e.message,
                    params,
                }));
            }
        });
    }
    getChannelStates() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const channel = yield this.store.getChannelStates();
                return vector_types_1.Result.ok(channel);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.StoreMethodFailed, "", this.publicIdentifier, {
                    storeMethod: "getChannelStates",
                    storeError: e.message,
                }));
            }
        });
    }
    getRegisteredTransfers(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.GetRegisteredTransfersSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const { chainId } = params;
            const result = yield this.chainService.getRegisteredTransfers(this.chainAddresses[chainId].transferRegistryAddress, chainId);
            return result;
        });
    }
    setup(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "setup";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.SetupSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const chainProviders = this.chainService.getChainProviders();
            if (chainProviders.isError) {
                return vector_types_1.Result.fail(chainProviders.getError());
            }
            const setupRes = yield this.vector.setup({
                counterpartyIdentifier: params.counterpartyIdentifier,
                timeout: params.timeout,
                networkContext: {
                    channelFactoryAddress: this.chainAddresses[params.chainId].channelFactoryAddress,
                    transferRegistryAddress: this.chainAddresses[params.chainId].transferRegistryAddress,
                    chainId: params.chainId,
                },
                meta: params.meta,
            });
            if (setupRes.isError) {
                return vector_types_1.Result.fail(setupRes.getError());
            }
            const channel = setupRes.getValue();
            if (this.signerAddress === channel.bob) {
                return setupRes;
            }
            if (!vector_types_1.AUTODEPLOY_CHAIN_IDS.includes(channel.networkContext.chainId)) {
                return setupRes;
            }
            this.logger.info({ method, chainId: channel.networkContext.chainId, channel: channel.channelAddress }, "Deploying channel multisig");
            const gasPriceRes = yield this.chainService.getGasPrice(channel.networkContext.chainId);
            if (gasPriceRes.isError) {
                vector_types_1.Result.fail(gasPriceRes.getError());
            }
            const _gasPrice = gasPriceRes.getValue();
            const gasPrice = _gasPrice.add(vector_contracts_1.EXTRA_GAS_PRICE);
            this.logger.info({ method, chainId: channel.networkContext.chainId, channel: channel.channelAddress }, "Got gas price");
            const deployRes = yield this.chainService.sendDeployChannelTx(channel, gasPrice);
            if (deployRes.isError) {
                const err = deployRes.getError();
                this.logger.error(Object.assign(Object.assign({}, ((_b = err === null || err === void 0 ? void 0 : err.context) !== null && _b !== void 0 ? _b : {})), { chainId: channel.networkContext.chainId, channel: channel.channelAddress, error: deployRes.getError().message }), "Failed to deploy channel multisig");
                return setupRes;
            }
            const tx = deployRes.getValue();
            this.logger.info({ chainId: channel.networkContext.chainId, hash: tx.hash }, "Deploy tx broadcast");
            const receipt = yield tx.wait();
            if (receipt.status === 0) {
                return vector_types_1.Result.fail(new vector_types_1.ChainError(vector_types_1.ChainError.reasons.TxReverted, { receipt }));
            }
            this.logger.debug({ chainId: channel.networkContext.chainId, hash: tx.hash }, "Deploy tx mined");
            this.logger.info({ result: setupRes.isError ? vector_types_1.jsonifyError(setupRes.getError()) : setupRes.getValue(), method, methodId }, "Method complete");
            return setupRes;
        });
    }
    requestSetup(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "requestSetup";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.SetupSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const res = yield this.messaging.sendSetupMessage(vector_types_1.Result.ok(params), params.counterpartyIdentifier, this.publicIdentifier);
            this.logger.info({ result: res.isError ? vector_types_1.jsonifyError(res.getError()) : res.getValue(), method, methodId }, "Method complete");
            return res;
        });
    }
    deposit(params) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "deposit";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.DepositSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            let depositRes = yield this.vector.deposit(params);
            let count = 1;
            for (const _ of Array(3).fill(0)) {
                if (!depositRes.isError) {
                    break;
                }
                const error = depositRes.getError();
                const recoveryErr = "Could not recover signers";
                const recoveryFailed = error.message === recoveryErr || ((_c = error.context) === null || _c === void 0 ? void 0 : _c.counterpartyError.message) === recoveryErr;
                if (!recoveryFailed) {
                    break;
                }
                this.logger.warn({ attempt: count, channelAddress: params.channelAddress }, "Retrying deposit reconciliation");
                depositRes = yield this.vector.deposit(params);
                count++;
            }
            this.logger.info({
                result: depositRes.isError ? vector_types_1.jsonifyError(depositRes.getError()) : depositRes.getValue(),
                method,
                methodId,
            }, "Method complete");
            return depositRes;
        });
    }
    requestCollateral(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "requestCollateral";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.RequestCollateralSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channelRes = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channelRes.isError) {
                return vector_types_1.Result.fail(channelRes.getError());
            }
            const channel = channelRes.getValue();
            if (!channel) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            const participant = vector_utils_1.getParticipant(channel, this.publicIdentifier);
            if (!participant) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.SignerNotInChannel, channel.channelAddress, this.publicIdentifier, {
                    alice: channel.aliceIdentifier,
                    bob: channel.bobIdentifier,
                    signer: this.publicIdentifier,
                }));
            }
            const request = yield this.messaging.sendRequestCollateralMessage(vector_types_1.Result.ok(params), participant === "alice" ? channel.bobIdentifier : channel.aliceIdentifier, this.publicIdentifier);
            this.logger.info({ result: request.isError ? vector_types_1.jsonifyError(request.getError()) : request.getValue(), method, methodId }, "Method complete");
            return request;
        });
    }
    createTransfer(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "createTransfer";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.ConditionalTransferSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channelRes = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channelRes.isError) {
                return vector_types_1.Result.fail(channelRes.getError());
            }
            const channel = channelRes.getValue();
            if (!channel) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            this.logger.info({ channel, method, methodId }, "Pre-transfer channel");
            const createResult = yield paramConverter_1.convertConditionalTransferParams(params, this.signer, channel, this.chainService, this.messaging);
            if (createResult.isError) {
                return vector_types_1.Result.fail(createResult.getError());
            }
            const createParams = createResult.getValue();
            this.logger.info({ transferParams: createParams, method, methodId }, "Created conditional transfer params");
            const protocolRes = yield this.vector.create(createParams);
            if (protocolRes.isError) {
                return vector_types_1.Result.fail(protocolRes.getError());
            }
            const res = protocolRes.getValue();
            this.logger.info({ channel: res, method, methodId }, "Method complete");
            return vector_types_1.Result.ok(res);
        });
    }
    resolveTransfer(params) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "resolveTransfer";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.ResolveTransferSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const transferRes = yield this.getTransferState({ transferId: params.transferId });
            if (transferRes.isError) {
                return vector_types_1.Result.fail(transferRes.getError());
            }
            const transfer = transferRes.getValue();
            if (!transfer) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.TransferNotFound, (_c = params.channelAddress) !== null && _c !== void 0 ? _c : "", this.publicIdentifier, {
                    transferId: params.transferId,
                }));
            }
            this.logger.info({ transfer, method, methodId }, "Transfer pre-resolve");
            const resolveResult = paramConverter_1.convertResolveConditionParams(params, transfer);
            if (resolveResult.isError) {
                return vector_types_1.Result.fail(resolveResult.getError());
            }
            const resolveParams = resolveResult.getValue();
            const protocolRes = yield this.vector.resolve(resolveParams);
            if (protocolRes.isError) {
                return vector_types_1.Result.fail(protocolRes.getError());
            }
            const res = protocolRes.getValue();
            this.logger.info({ channel: res, method, methodId }, "Method complete");
            return vector_types_1.Result.ok(res);
        });
    }
    withdraw(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "withdraw";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.WithdrawSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channelRes = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channelRes.isError) {
                return vector_types_1.Result.fail(channelRes.getError());
            }
            const channel = channelRes.getValue();
            if (!channel) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            const createResult = yield paramConverter_1.convertWithdrawParams(params, this.signer, channel, this.chainAddresses, this.chainService, this.messaging);
            if (createResult.isError) {
                return vector_types_1.Result.fail(createResult.getError());
            }
            const createParams = createResult.getValue();
            const protocolRes = yield this.vector.create(createParams);
            if (protocolRes.isError) {
                return vector_types_1.Result.fail(protocolRes.getError());
            }
            const res = protocolRes.getValue();
            const transferId = res.latestUpdate.details.transferId;
            this.logger.info({ channelAddress: params.channelAddress, transferId }, "Withdraw transfer created");
            let transactionHash = undefined;
            const timeout = 90000;
            try {
                const event = yield this.evts[vector_types_1.WITHDRAWAL_RECONCILED_EVENT].attachOnce(timeout, (data) => data.channelAddress === params.channelAddress && data.transferId === transferId);
                transactionHash = event.transactionHash;
            }
            catch (e) {
                this.logger.warn({ channelAddress: params.channelAddress, transferId, timeout }, "Withdraw tx not submitted");
            }
            this.logger.info({ channel: res, method, methodId }, "Method complete");
            return vector_types_1.Result.ok({ channel: res, transactionHash });
        });
    }
    decrypt(encrypted) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "decrypt";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ encrypted, method, methodId }, "Method started");
            try {
                const res = yield this.signer.decrypt(encrypted);
                this.logger.info({ res, method, methodId }, "Method complete");
                return vector_types_1.Result.ok(res);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.DecryptFailed, "", this.publicIdentifier, {
                    decryptError: e.message,
                }));
            }
        });
    }
    signUtilityMessage(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "signUtilityMessage";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.SignUtilityMessageSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const sig = yield this.signer.signUtilityMessage(params.message);
                this.logger.info({ sig, method, methodId }, "Method complete");
                return vector_types_1.Result.ok(sig);
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.UtilitySigningFailed, "", this.publicIdentifier, {
                    signingError: e.message,
                }));
            }
        });
    }
    sendIsAlive(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "sendIsAlive";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.SendIsAliveSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            try {
                const channel = yield this.store.getChannelState(params.channelAddress);
                if (!channel) {
                    return vector_types_1.Result.fail(new errors_1.IsAliveError(errors_1.IsAliveError.reasons.ChannelNotFound, params.channelAddress, this.signer.publicIdentifier));
                }
                const counterparty = this.signer.address === channel.alice ? channel.bobIdentifier : channel.aliceIdentifier;
                const res = yield this.messaging.sendIsAliveMessage(vector_types_1.Result.ok(params), counterparty, this.signer.publicIdentifier);
                this.logger.info({ result: res.isError ? vector_types_1.jsonifyError(res.getError()) : res.getValue(), method, methodId }, "Method complete");
                return res;
            }
            catch (e) {
                return vector_types_1.Result.fail(new errors_1.IsAliveError(errors_1.IsAliveError.reasons.Unknown, params.channelAddress, this.signer.publicIdentifier, {
                    isAliveError: e.message,
                }));
            }
        });
    }
    restoreState(params) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const method = "restoreState";
            const methodId = vector_utils_1.getRandomBytes32();
            this.logger.info({ params, method, methodId }, "Method started");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.RestoreStateSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const { chainId, counterpartyIdentifier } = params;
            const restoreDataRes = yield this.messaging.sendRestoreStateMessage(vector_types_1.Result.ok({ chainId }), counterpartyIdentifier, this.signer.publicIdentifier);
            if (restoreDataRes.isError) {
                return vector_types_1.Result.fail(restoreDataRes.getError());
            }
            const { channel, activeTransfers } = (_b = restoreDataRes.getValue()) !== null && _b !== void 0 ? _b : {};
            const sendResponseToCounterparty = (error, context = {}) => __awaiter(this, void 0, void 0, function* () {
                var _e;
                if (!error) {
                    const res = yield this.messaging.sendRestoreStateMessage(vector_types_1.Result.ok({
                        channelAddress: channel.channelAddress,
                    }), counterpartyIdentifier, this.signer.publicIdentifier);
                    if (res.isError) {
                        error = errors_1.RestoreError.reasons.AckFailed;
                        context = { error: vector_types_1.jsonifyError(res.getError()) };
                    }
                    else {
                        return vector_types_1.Result.ok(channel);
                    }
                }
                const err = new errors_1.RestoreError(error, (_e = channel === null || channel === void 0 ? void 0 : channel.channelAddress) !== null && _e !== void 0 ? _e : "", this.publicIdentifier, Object.assign(Object.assign({}, context), { method,
                    params }));
                yield this.messaging.sendRestoreStateMessage(vector_types_1.Result.fail(err), counterpartyIdentifier, this.signer.publicIdentifier);
                return vector_types_1.Result.fail(err);
            });
            if (!channel || !activeTransfers) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.NoData);
            }
            const counterparty = vector_utils_1.getSignerAddressFromPublicIdentifier(counterpartyIdentifier);
            const calculated = yield this.chainService.getChannelAddress(channel.alice === this.signer.address ? this.signer.address : counterparty, channel.bob === this.signer.address ? this.signer.address : counterparty, channel.networkContext.channelFactoryAddress, chainId);
            if (calculated.isError) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.GetChannelAddressFailed, {
                    getChannelAddressError: vector_types_1.jsonifyError(calculated.getError()),
                });
            }
            if (calculated.getValue() !== channel.channelAddress) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.InvalidChannelAddress, {
                    calculated: calculated.getValue(),
                });
            }
            const sigRes = yield vector_utils_1.validateChannelUpdateSignatures(channel, channel.latestUpdate.aliceSignature, channel.latestUpdate.bobSignature, "both");
            if (sigRes.isError) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.InvalidSignatures, {
                    recoveryError: sigRes.getError().message,
                });
            }
            const { root } = vector_utils_1.generateMerkleTreeData(activeTransfers);
            if (root !== channel.merkleRoot) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.InvalidMerkleRoot, {
                    calculated: root,
                    merkleRoot: channel.merkleRoot,
                    activeTransfers: activeTransfers.map((t) => t.transferId),
                });
            }
            const existing = yield this.getChannelState({ channelAddress: channel.channelAddress });
            if (existing.isError) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.CouldNotGetChannel, {
                    getChannelStateError: vector_types_1.jsonifyError(existing.getError()),
                });
            }
            const nonce = (_d = (_c = existing.getValue()) === null || _c === void 0 ? void 0 : _c.nonce) !== null && _d !== void 0 ? _d : 0;
            const diff = channel.nonce - nonce;
            if (diff <= 1 && channel.latestUpdate.type !== vector_types_1.UpdateType.setup) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.SyncableState, {
                    existing: nonce,
                    toRestore: channel.nonce,
                });
            }
            try {
                yield this.store.saveChannelStateAndTransfers(channel, activeTransfers);
            }
            catch (e) {
                return sendResponseToCounterparty(errors_1.RestoreError.reasons.SaveChannelFailed, {
                    saveChannelStateAndTransfersError: e.message,
                });
            }
            const returnVal = yield sendResponseToCounterparty();
            this.evts[vector_types_1.EngineEvents.RESTORE_STATE_EVENT].post({
                channelAddress: channel.channelAddress,
                aliceIdentifier: channel.aliceIdentifier,
                bobIdentifier: channel.bobIdentifier,
                chainId,
            });
            this.logger.info({
                result: returnVal.isError ? vector_types_1.jsonifyError(returnVal.getError()) : returnVal.getValue(),
                method,
                methodId,
            }, "Method complete");
            return returnVal;
        });
    }
    dispute(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.DisputeChannelSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channel = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channel.isError) {
                return vector_types_1.Result.fail(channel.getError());
            }
            const state = channel.getValue();
            if (!state) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            const disputeRes = yield this.chainService.sendDisputeChannelTx(state);
            if (disputeRes.isError) {
                return vector_types_1.Result.fail(disputeRes.getError());
            }
            return vector_types_1.Result.ok({ transactionHash: disputeRes.getValue().hash });
        });
    }
    defund(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.DefundChannelSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, (_a = params.channelAddress) !== null && _a !== void 0 ? _a : "", this.publicIdentifier, {
                    invalidParamsError: (_b = validate.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const channel = yield this.getChannelState({ channelAddress: params.channelAddress });
            if (channel.isError) {
                return vector_types_1.Result.fail(channel.getError());
            }
            const state = channel.getValue();
            if (!state) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.ChannelNotFound, params.channelAddress, this.publicIdentifier));
            }
            if (!state.inDispute) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.ChannelNotInDispute, params.channelAddress, this.publicIdentifier));
            }
            const disputeRes = yield this.chainService.sendDefundChannelTx(state);
            if (disputeRes.isError) {
                return vector_types_1.Result.fail(disputeRes.getError());
            }
            return vector_types_1.Result.ok({ transactionHash: disputeRes.getValue().hash });
        });
    }
    disputeTransfer(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.DisputeTransferSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const transferRes = yield this.getTransferState(params);
            if (transferRes.isError) {
                return vector_types_1.Result.fail(transferRes.getError());
            }
            const transfer = transferRes.getValue();
            if (!transfer) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.TransferNotFound, "", this.publicIdentifier, {
                    transferId: params.transferId,
                }));
            }
            const activeRes = yield this.getActiveTransfers({ channelAddress: transfer.channelAddress });
            if (activeRes.isError) {
                return vector_types_1.Result.fail(activeRes.getError());
            }
            const disputeRes = yield this.chainService.sendDisputeTransferTx(transfer.transferId, activeRes.getValue());
            if (disputeRes.isError) {
                return vector_types_1.Result.fail(disputeRes.getError());
            }
            return vector_types_1.Result.ok({ transactionHash: disputeRes.getValue().hash });
        });
    }
    defundTransfer(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const validate = exports.ajv.compile(vector_types_1.EngineParams.DefundTransferSchema);
            const valid = validate(params);
            if (!valid) {
                return vector_types_1.Result.fail(new errors_1.RpcError(errors_1.RpcError.reasons.InvalidParams, "", this.publicIdentifier, {
                    invalidParamsError: (_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message).join(","),
                    invalidParams: params,
                }));
            }
            const transferRes = yield this.getTransferState(params);
            if (transferRes.isError) {
                return vector_types_1.Result.fail(transferRes.getError());
            }
            const transfer = transferRes.getValue();
            if (!transfer) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.TransferNotFound, "", this.publicIdentifier, {
                    transferId: params.transferId,
                }));
            }
            if (!transfer.inDispute) {
                return vector_types_1.Result.fail(new errors_1.DisputeError(errors_1.DisputeError.reasons.TransferNotDisputed, transfer.channelAddress, this.publicIdentifier, {
                    transferId: transfer.transferId,
                }));
            }
            const defundRes = yield this.chainService.sendDefundTransferTx(transfer);
            if (defundRes.isError) {
                return vector_types_1.Result.fail(defundRes.getError());
            }
            return vector_types_1.Result.ok({ transactionHash: defundRes.getValue().hash });
        });
    }
    request(payload) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug({ payload, method: "request" }, "Method called");
            const validate = exports.ajv.compile(vector_types_1.EngineParams.RpcRequestSchema);
            const valid = validate(payload);
            if (!valid) {
                this.logger.error(Object.assign({ method: "request", payload }, ((_a = validate.errors) !== null && _a !== void 0 ? _a : {})));
                throw new errors_1.RpcError(errors_1.RpcError.reasons.InvalidRpcSchema, (_c = (_b = payload.params) === null || _b === void 0 ? void 0 : _b.channelAddress) !== null && _c !== void 0 ? _c : "", this.publicIdentifier, {
                    invalidRpcRequest: payload,
                    invalidRpcRequestError: (_d = validate.errors) === null || _d === void 0 ? void 0 : _d.map((err) => err.message).join(","),
                });
            }
            const methodName = payload.method.replace("chan_", "");
            if (typeof this[methodName] !== "function") {
                throw new errors_1.RpcError(errors_1.RpcError.reasons.InvalidMethod, (_f = (_e = payload.params) === null || _e === void 0 ? void 0 : _e.channelAddress) !== null && _f !== void 0 ? _f : "", this.publicIdentifier, {
                    payload,
                });
            }
            const res = yield this[methodName](payload.params);
            if (res.isError) {
                throw res.getError();
            }
            return res.getValue();
        });
    }
    on(event, callback, filter = () => true) {
        this.evts[event].pipe(filter).attach(callback);
    }
    once(event, callback, filter = () => true) {
        this.evts[event].pipe(filter).attachOnce(callback);
    }
    waitFor(event, timeout, filter = () => true) {
        return this.evts[event].pipe(filter).waitFor(timeout);
    }
    off(event) {
        if (event) {
            this.evts[event].detach();
            return;
        }
        Object.keys(vector_types_1.EngineEvents).forEach((k) => this.evts[k].detach());
    }
}
exports.VectorEngine = VectorEngine;
//# sourceMappingURL=index.js.map