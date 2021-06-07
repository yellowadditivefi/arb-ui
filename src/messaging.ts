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
exports.NatsMessagingService = exports.NatsBasicMessagingService = exports.getBearerToken = exports.AuthService = void 0;
const vector_types_1 = require("@connext/vector-types");
const axios_1 = __importDefault(require("axios"));
const pino_1 = __importDefault(require("pino"));
const ts_natsutil_1 = require("ts-natsutil");
const env_1 = require("./env");
const json_1 = require("./json");
var ts_natsutil_2 = require("ts-natsutil");
Object.defineProperty(exports, "AuthService", { enumerable: true, get: function () { return ts_natsutil_2.AuthService; } });
exports.getBearerToken = (authUrl, signer) => () => __awaiter(void 0, void 0, void 0, function* () {
    const nonceResponse = yield axios_1.default.get(`${authUrl}/auth/${signer.publicIdentifier}`);
    const nonce = nonceResponse.data;
    const sig = yield signer.signMessage(nonce);
    const verifyResponse = yield axios_1.default.post(`${authUrl}/auth`, {
        sig,
        userIdentifier: signer.publicIdentifier,
    });
    return verifyResponse.data;
});
class NatsBasicMessagingService {
    constructor(config) {
        this.log = config.logger || pino_1.default();
        if (config.messagingUrl) {
            this.authUrl = config.messagingUrl;
            if (env_1.isNode()) {
                this.natsUrl = `nats://${config.messagingUrl
                    .replace(/^.*:\/\//, "")
                    .replace(/\//, "")
                    .replace(/:[0-9]+/, "")}:4222`;
            }
            else {
                this.natsUrl = `${config.messagingUrl.replace(/:\/\/.*/, "").replace("http", "ws")}://${config.messagingUrl.replace(/^.*:\/\//, "").replace(/\//, "")}/ws-nats`;
            }
            this.log.info(`Derived natsUrl=${this.natsUrl} from messagingUrl=${config.messagingUrl}`);
        }
        else if (!config.authUrl || !config.natsUrl) {
            throw new Error(`Either a messagingUrl or both an authUrl + natsUrl must be provided`);
        }
        if (config.authUrl) {
            this.authUrl = config.authUrl;
        }
        if (config.natsUrl) {
            this.natsUrl = config.natsUrl;
        }
        if (config.bearerToken) {
            this.bearerToken = config.bearerToken;
        }
        else if (config.signer) {
            this.signer = config.signer;
        }
        else {
            throw new Error(`Either a bearerToken or signer must be provided`);
        }
    }
    isConnected() {
        var _a;
        return !!((_a = this.connection) === null || _a === void 0 ? void 0 : _a.isConnected());
    }
    assertConnected() {
        if (!this.isConnected()) {
            throw new Error(`No connection detected, use connect() method`);
        }
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bearerToken) {
                const nonce = (yield axios_1.default.get(`${this.authUrl}/auth/${this.signer.publicIdentifier}`)).data;
                const sig = yield this.signer.signMessage(nonce);
                const verifyResponse = yield axios_1.default.post(`${this.authUrl}/auth`, {
                    sig,
                    userIdentifier: this.signer.publicIdentifier,
                });
                this.bearerToken = verifyResponse.data;
            }
            const service = ts_natsutil_1.natsServiceFactory({
                bearerToken: this.bearerToken,
                natsServers: [this.natsUrl],
            }, this.log.child({ module: "Messaging-Nats" }));
            const natsConnection = yield service.connect();
            this.connection = service;
            this.log.debug(`Connected!`);
            if (typeof natsConnection.addEventListener === "function") {
                natsConnection.addEventListener("close", () => __awaiter(this, void 0, void 0, function* () {
                    this.bearerToken = undefined;
                    yield this.connect();
                }));
            }
            else {
                natsConnection.on("close", () => __awaiter(this, void 0, void 0, function* () {
                    this.bearerToken = undefined;
                    yield this.connect();
                }));
            }
        });
    }
    disconnect() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            (_a = this.connection) === null || _a === void 0 ? void 0 : _a.disconnect();
        });
    }
    publish(subject, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnected();
            const toPublish = json_1.safeJsonStringify(data);
            this.log.debug({ subject, data }, `Publishing`);
            yield this.connection.publish(subject, toPublish);
        });
    }
    request(subject, timeout, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnected();
            this.log.debug(`Requesting ${subject} with data: ${JSON.stringify(data)}`);
            const response = yield this.connection.request(subject, timeout, JSON.stringify(data));
            this.log.debug(`Request for ${subject} returned: ${JSON.stringify(response)}`);
            return response;
        });
    }
    subscribe(subject, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnected();
            yield this.connection.subscribe(subject, (msg, err) => {
                const parsedMsg = typeof msg === `string` ? JSON.parse(msg) : msg;
                const parsedData = typeof msg.data === `string` ? JSON.parse(msg.data) : msg.data;
                parsedMsg.data = parsedData;
                callback(msg, err);
            });
            this.log.debug({ subject }, `Subscription created`);
        });
    }
    unsubscribe(subject) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnected();
            const unsubscribeFrom = this.getSubjectsToUnsubscribeFrom(subject);
            unsubscribeFrom.forEach((sub) => {
                this.connection.unsubscribe(sub);
            });
        });
    }
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.connection.flush();
        });
    }
    getSubjectsToUnsubscribeFrom(subject) {
        const subscribedTo = this.connection.getSubscribedSubjects();
        const unsubscribeFrom = [];
        const substrsToMatch = subject.split(`>`)[0].split(`*`);
        subscribedTo.forEach((subscribedSubject) => {
            let subjectIncludesAllSubstrings = true;
            substrsToMatch.forEach((match) => {
                if (!(subscribedSubject !== null && subscribedSubject !== void 0 ? subscribedSubject : "").includes(match) && match !== ``) {
                    subjectIncludesAllSubstrings = false;
                }
            });
            if (subjectIncludesAllSubstrings) {
                unsubscribeFrom.push(subscribedSubject);
            }
        });
        return unsubscribeFrom;
    }
    respondToMessage(inbox, response, method) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug({ method, inbox }, `Sending response`);
            yield this.publish(inbox, response.toJson());
        });
    }
    registerCallback(subscriptionSubject, callback, method) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.subscribe(subscriptionSubject, (msg, err) => {
                this.log.debug({ method, msg }, "Received message");
                const from = msg.subject.split(".")[1];
                if (err) {
                    callback(vector_types_1.Result.fail(new vector_types_1.MessagingError(err)), from, msg.reply);
                    return;
                }
                const { result, parsed } = this.parseIncomingMessage(msg);
                if (!parsed.reply) {
                    return;
                }
                callback(result, from, msg.reply);
                return;
            });
            this.log.debug({ method, subject: subscriptionSubject }, `Subscription created`);
        });
    }
    sendMessage(data, subjectSuffix, to, from, timeout, method) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnected();
            const subject = `${to}.${from}.${subjectSuffix}`;
            const msgBody = json_1.safeJsonStringify(data.toJson());
            try {
                this.log.debug({ method, msgBody }, "Sending message");
                const msg = yield this.request(subject, timeout, msgBody);
                this.log.debug({ method, msg }, "Received response");
                const { result } = this.parseIncomingMessage(msg);
                return result;
            }
            catch (e) {
                this.log.error({ error: (_a = e.message) !== null && _a !== void 0 ? _a : e, subject: subjectSuffix, data: msgBody, method }, "Sending message failed");
                const error = (_c = (_b = e.message) !== null && _b !== void 0 ? _b : e) !== null && _c !== void 0 ? _c : "";
                return vector_types_1.Result.fail(new vector_types_1.MessagingError(error.includes("Request timed out") || error.includes("timeout")
                    ? vector_types_1.MessagingError.reasons.Timeout
                    : vector_types_1.MessagingError.reasons.Unknown, {
                    messagingError: (_d = e.message) !== null && _d !== void 0 ? _d : e,
                    subject,
                    data: data.toJson(),
                    method,
                }));
            }
        });
    }
    sendMessageWithRetries(data, subjectSuffix, to, from, timeout, numRetries, method) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.sendMessage(data, subjectSuffix, to, from, timeout, method);
            return result;
        });
    }
    parseIncomingMessage(msg) {
        const parsedMsg = typeof msg === `string` ? json_1.safeJsonParse(msg) : msg;
        const parsedData = typeof msg.data === `string` ? json_1.safeJsonParse(msg.data) : msg.data;
        parsedMsg.data = parsedData;
        return { result: vector_types_1.Result.fromJson(parsedMsg.data), parsed: parsedMsg };
    }
}
exports.NatsBasicMessagingService = NatsBasicMessagingService;
class NatsMessagingService extends NatsBasicMessagingService {
    constructor(config) {
        var _a;
        super(config);
        this.config = config;
        this.logger = (_a = config.logger) !== null && _a !== void 0 ? _a : pino_1.default();
    }
    sendProtocolMessage(channelUpdate, previousUpdate, timeout = 30000, numRetries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessageWithRetries(vector_types_1.Result.ok({ update: channelUpdate, previousUpdate }), "protocol", channelUpdate.toIdentifier, channelUpdate.fromIdentifier, timeout, numRetries, "sendProtocolMessage");
        });
    }
    onReceiveProtocolMessage(myPublicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerCallback(`${myPublicIdentifier}.*.protocol`, callback, "onReceiveProtocolMessage");
        });
    }
    respondToProtocolMessage(inbox, channelUpdate, previousUpdate) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, vector_types_1.Result.ok({ update: channelUpdate, previousUpdate }), "respondToProtocolMessage");
        });
    }
    respondWithProtocolError(inbox, error) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, vector_types_1.Result.fail(error), "respondWithProtocolError");
        });
    }
    sendRestoreStateMessage(restoreData, to, from, timeout = 30000, numRetries) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessageWithRetries(restoreData, "restore", to, from, timeout, numRetries, "sendRestoreStateMessage");
        });
    }
    onReceiveRestoreStateMessage(publicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.registerCallback(`${publicIdentifier}.*.restore`, callback, "onReceiveRestoreStateMessage");
        });
    }
    respondToRestoreStateMessage(inbox, restoreData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, restoreData, "respondToRestoreStateMessage");
        });
    }
    sendSetupMessage(setupInfo, to, from, timeout = 30000, numRetries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "sendSetupMessage";
            return this.sendMessageWithRetries(setupInfo, "setup", to, from, timeout, numRetries, method);
        });
    }
    onReceiveSetupMessage(publicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.registerCallback(`${publicIdentifier}.*.setup`, callback, "onReceiveSetupMessage");
        });
    }
    respondToSetupMessage(inbox, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, params, "respondToSetupMessage");
        });
    }
    sendRequestCollateralMessage(requestCollateralParams, to, from, timeout = 30000, numRetries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessageWithRetries(requestCollateralParams, "request-collateral", to, from, timeout, numRetries, "sendRequestCollateralMessage");
        });
    }
    onReceiveRequestCollateralMessage(publicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerCallback(`${publicIdentifier}.*.request-collateral`, callback, "onReceiveRequestCollateralMessage");
        });
    }
    respondToRequestCollateralMessage(inbox, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, params, "respondToRequestCollateralMessage");
        });
    }
    sendLockMessage(lockInfo, to, from, timeout = 30000, numRetries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessageWithRetries(lockInfo, "lock", to, from, timeout, numRetries, "sendLockMessage");
        });
    }
    onReceiveLockMessage(publicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerCallback(`${publicIdentifier}.*.lock`, callback, "onReceiveLockMessage");
        });
    }
    respondToLockMessage(inbox, lockInformation) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.respondToMessage(inbox, lockInformation, "respondToLockMessage");
        });
    }
    sendIsAliveMessage(isAlive, to, from, timeout = 30000, numRetries) {
        return this.sendMessageWithRetries(isAlive, "isalive", to, from, timeout, numRetries, "sendIsAliveMessage");
    }
    onReceiveIsAliveMessage(publicIdentifier, callback) {
        return this.registerCallback(`${publicIdentifier}.*.isalive`, callback, "onReceiveIsAliveMessage");
    }
    respondToIsAliveMessage(inbox, params) {
        return this.respondToMessage(inbox, params, "respondToIsAliveMessage");
    }
    sendRouterConfigMessage(configRequest, to, from, timeout = 30000, numRetries) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessageWithRetries(configRequest, "config", to, from, timeout, numRetries, "sendRouterConfigMessage");
        });
    }
    sendTransferQuoteMessage(quoteRequest, to, from, timeout = 30000, numRetries) {
        return this.sendMessageWithRetries(quoteRequest, "transfer-quote", to, from, timeout, numRetries, "sendTransferQuoteMessage");
    }
    sendWithdrawalQuoteMessage(quoteRequest, to, from, timeout = 30000, numRetries) {
        return this.sendMessageWithRetries(quoteRequest, "withdrawal-quote", to, from, timeout, numRetries, "sendWithdrawalQuoteMessage");
    }
    onReceiveWithdrawalQuoteMessage(myPublicIdentifier, callback) {
        return this.registerCallback(`${myPublicIdentifier}.*.withdrawal-quote`, callback, "onReceiveWithdrawalQuoteMessage");
    }
    respondToWithdrawalQuoteMessage(inbox, quote) {
        return this.respondToMessage(inbox, quote, "respondToWithdrawalQuoteMessage");
    }
}
exports.NatsMessagingService = NatsMessagingService;
//# sourceMappingURL=messaging.js.map