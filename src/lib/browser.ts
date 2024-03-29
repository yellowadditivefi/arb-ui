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
const constants_1 = require("../constants");
const helpers_1 = require("../helpers");
const fallback_1 = require("./fallback");
function getBrowerCrypto() {
    var _a, _b;
    return ((_a = global) === null || _a === void 0 ? void 0 : _a.crypto) || ((_b = global) === null || _b === void 0 ? void 0 : _b.msCrypto) || {};
}
exports.getBrowerCrypto = getBrowerCrypto;
function getSubtleCrypto() {
    const browserCrypto = getBrowerCrypto();
    return browserCrypto.subtle || browserCrypto.webkitSubtle;
}
exports.getSubtleCrypto = getSubtleCrypto;
function getAlgo(type) {
    return type === constants_1.AES_BROWSER_ALGO
        ? { length: constants_1.AES_LENGTH, name: constants_1.AES_BROWSER_ALGO }
        : {
            hash: { name: constants_1.HMAC_BROWSER_ALGO },
            name: constants_1.HMAC_BROWSER,
        };
}
exports.getAlgo = getAlgo;
function getOps(type) {
    return type === constants_1.AES_BROWSER_ALGO
        ? [constants_1.ENCRYPT_OP, constants_1.DECRYPT_OP]
        : [constants_1.SIGN_OP, constants_1.VERIFY_OP];
}
exports.getOps = getOps;
function browserRandomBytes(length) {
    const browserCrypto = getBrowerCrypto();
    if (typeof browserCrypto.getRandomValues !== 'undefined') {
        return helpers_1.arrayToBuffer(browserCrypto.getRandomValues(new Uint8Array(length)));
    }
    return fallback_1.fallbackRandomBytes(length);
}
exports.browserRandomBytes = browserRandomBytes;
function browserExportKey(cryptoKey, type = constants_1.AES_BROWSER_ALGO) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        return helpers_1.arrayToBuffer(new Uint8Array(yield subtle.exportKey('raw', cryptoKey)));
    });
}
exports.browserExportKey = browserExportKey;
function browserImportKey(buffer, type = constants_1.AES_BROWSER_ALGO) {
    return __awaiter(this, void 0, void 0, function* () {
        return getSubtleCrypto().importKey('raw', buffer, getAlgo(type), true, getOps(type));
    });
}
exports.browserImportKey = browserImportKey;
function browserAesEncrypt(iv, key, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const cryptoKey = yield browserImportKey(key, constants_1.AES_BROWSER_ALGO);
        const result = yield subtle.encrypt({
            iv,
            name: constants_1.AES_BROWSER_ALGO,
        }, cryptoKey, data);
        return Buffer.from(result);
    });
}
exports.browserAesEncrypt = browserAesEncrypt;
function browserAesDecrypt(iv, key, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const cryptoKey = yield browserImportKey(key, constants_1.AES_BROWSER_ALGO);
        const result = yield subtle.decrypt({
            iv,
            name: constants_1.AES_BROWSER_ALGO,
        }, cryptoKey, data);
        return Buffer.from(result);
    });
}
exports.browserAesDecrypt = browserAesDecrypt;
function browserHmacSha256Sign(key, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const cryptoKey = yield browserImportKey(key, constants_1.HMAC_BROWSER);
        const signature = yield subtle.sign({
            length: constants_1.HMAC_LENGTH,
            name: constants_1.HMAC_BROWSER,
        }, cryptoKey, data);
        return Buffer.from(signature);
    });
}
exports.browserHmacSha256Sign = browserHmacSha256Sign;
function browserHmacSha512Sign(key, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const cryptoKey = yield browserImportKey(key, constants_1.HMAC_BROWSER);
        const signature = yield subtle.sign({
            length: constants_1.LENGTH_512,
            name: constants_1.HMAC_BROWSER,
        }, cryptoKey, data);
        return Buffer.from(signature);
    });
}
exports.browserHmacSha512Sign = browserHmacSha512Sign;
function browserSha256(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const result = yield subtle.digest({
            name: constants_1.SHA256_BROWSER_ALGO,
        }, data);
        return Buffer.from(result);
    });
}
exports.browserSha256 = browserSha256;
function browserSha512(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const subtle = getSubtleCrypto();
        const result = yield subtle.digest({
            name: constants_1.SHA512_BROWSER_ALGO,
        }, data);
        return Buffer.from(result);
    });
}
exports.browserSha512 = browserSha512;
//# sourceMappingURL=browser.js.map