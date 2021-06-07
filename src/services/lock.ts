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
exports.BrowserLockService = void 0;
const vector_types_1 = require("@connext/vector-types");
const errors_1 = require("../errors");
class BrowserLockService {
    constructor(publicIdentifier, messagingService, log) {
        this.publicIdentifier = publicIdentifier;
        this.messagingService = messagingService;
        this.log = log;
    }
    acquireLock(lockName, isAlice, counterpartyPublicIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!counterpartyPublicIdentifier) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.CounterpartyIdentifierMissing, lockName);
            }
            if (isAlice) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.CannotBeAlice, lockName);
            }
            const res = yield this.messagingService.sendLockMessage(vector_types_1.Result.ok({ type: "acquire", lockName }), counterpartyPublicIdentifier, this.publicIdentifier);
            if (res.isError) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.AcquireMessageFailed, lockName, "", {
                    error: vector_types_1.jsonifyError(res.getError()),
                });
            }
            const { lockValue } = res.getValue();
            if (!lockValue) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.SentMessageAcquisitionFailed, lockName);
            }
            this.log.debug({ method: "acquireLock", lockName, lockValue }, "Acquired lock");
            return lockValue;
        });
    }
    releaseLock(lockName, lockValue, isAlice, counterpartyPublicIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!counterpartyPublicIdentifier) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.CounterpartyIdentifierMissing, lockName, lockValue);
            }
            if (isAlice) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.CannotBeAlice, lockName, lockValue);
            }
            const result = yield this.messagingService.sendLockMessage(vector_types_1.Result.ok({ type: "release", lockName, lockValue }), counterpartyPublicIdentifier, this.publicIdentifier);
            if (result.isError) {
                throw new errors_1.BrowserNodeLockError(errors_1.BrowserNodeLockError.reasons.ReleaseMessageFailed, lockName, "", {
                    error: vector_types_1.jsonifyError(result.getError()),
                });
            }
            this.log.debug({ method: "releaseLock", lockName, lockValue }, "Released lock");
        });
    }
}
exports.BrowserLockService = BrowserLockService;
//# sourceMappingURL=lock.js.map