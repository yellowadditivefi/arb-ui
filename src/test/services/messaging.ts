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
exports.MemoryMessagingService = void 0;
const vector_types_1 = require("@connext/vector-types");
const evt_1 = require("evt");
const hexStrings_1 = require("../../hexStrings");
class MemoryMessagingService {
    constructor() {
        this.evt = evt_1.Evt.create();
    }
    flush() {
        throw new Error("Method not implemented.");
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.evt.detach();
        });
    }
    sendProtocolMessage(channelUpdate, previousUpdate, timeout = 20000, numRetries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const inbox = hexStrings_1.getRandomBytes32();
            const responsePromise = this.evt.pipe((e) => e.inbox === inbox).waitFor(timeout);
            this.evt.post({
                to: channelUpdate.toIdentifier,
                from: channelUpdate.fromIdentifier,
                replyTo: inbox,
                data: { update: channelUpdate, previousUpdate },
            });
            const res = yield responsePromise;
            if (res.data.error) {
                return vector_types_1.Result.fail(res.data.error);
            }
            return vector_types_1.Result.ok({ update: res.data.update, previousUpdate: res.data.previousUpdate });
        });
    }
    respondToProtocolMessage(inbox, channelUpdate, previousUpdate) {
        return __awaiter(this, void 0, void 0, function* () {
            this.evt.post({
                inbox,
                data: { update: channelUpdate, previousUpdate },
                from: channelUpdate.toIdentifier,
            });
        });
    }
    respondWithProtocolError(inbox, error) {
        return __awaiter(this, void 0, void 0, function* () {
            this.evt.post({
                inbox,
                data: { error },
                from: error.context.update.toIdentifier,
            });
        });
    }
    onReceiveProtocolMessage(myPublicIdentifier, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.evt
                .pipe(({ to }) => to === myPublicIdentifier)
                .attach(({ data, replyTo, from }) => {
                callback(vector_types_1.Result.ok({
                    previousUpdate: data.previousUpdate,
                    update: data.update,
                }), from, replyTo);
            });
        });
    }
    sendSetupMessage(setupInfo, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    onReceiveSetupMessage(publicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    respondToSetupMessage(inbox, params) {
        throw new Error("Method not implemented.");
    }
    sendRequestCollateralMessage(requestCollateralParams, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    onReceiveRequestCollateralMessage(publicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    respondToRequestCollateralMessage(inbox, params) {
        throw new Error("Method not implemented.");
    }
    sendRestoreStateMessage(restoreData, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    onReceiveRestoreStateMessage(publicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    respondToRestoreStateMessage(inbox, restoreData) {
        throw new Error("Method not implemented.");
    }
    respondToLockMessage(inbox, lockInformation) {
        throw new Error("Method not implemented.");
    }
    onReceiveLockMessage(myPublicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    sendLockMessage(lockInfo, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    sendIsAliveMessage(isAlive, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    onReceiveIsAliveMessage(publicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    respondToIsAliveMessage(inbox, params) {
        throw new Error("Method not implemented.");
    }
    sendRouterConfigMessage(configRequest, to, from, timeout, numRetries) {
        throw new Error("Method not implemented");
    }
    sendTransferQuoteMessage(quoteRequest, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    onReceiveWithdrawalQuoteMessage(myPublicIdentifier, callback) {
        throw new Error("Method not implemented.");
    }
    sendWithdrawalQuoteMessage(quoteRequest, to, from, timeout, numRetries) {
        throw new Error("Method not implemented.");
    }
    respondToWithdrawalQuoteMessage(inbox, quote) {
        throw new Error("Method not implemented.");
    }
    subscribe(subject, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("Method not implemented.");
        });
    }
    request(subject, timeout, data) {
        throw new Error("Method not implemented.");
    }
    publish(subject, data) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("Method not implemented.");
        });
    }
    unsubscribe(subject) {
        throw new Error("Method not implemented.");
    }
}
exports.MemoryMessagingService = MemoryMessagingService;
//# sourceMappingURL=messaging.js.map