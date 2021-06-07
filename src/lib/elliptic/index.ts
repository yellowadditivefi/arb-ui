"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elliptic_1 = require("elliptic");
const signature_1 = require("elliptic/lib/elliptic/ec/signature");
const random_1 = require("../../random");
const constants_1 = require("../../constants");
const helpers_1 = require("../../helpers");
const ec = new elliptic_1.ec('secp256k1');
function ellipticRSVSignature(signature) {
    return helpers_1.concatBuffers(helpers_1.hexToBuffer(helpers_1.padLeft(helpers_1.removeHexPrefix(helpers_1.sanitizeHex(signature.r.toString(16))), 64)), helpers_1.hexToBuffer(helpers_1.padLeft(helpers_1.removeHexPrefix(helpers_1.sanitizeHex(signature.s.toString(16))), 64)), helpers_1.exportRecoveryParam(signature.recoveryParam || 0));
}
exports.ellipticRSVSignature = ellipticRSVSignature;
function ellipticCompress(publicKey) {
    publicKey = helpers_1.sanitizePublicKey(publicKey);
    const pubPoint = ec.keyFromPublic(publicKey);
    const hex = pubPoint.getPublic().encode(constants_1.HEX_ENC, true);
    return helpers_1.hexToBuffer(hex);
}
exports.ellipticCompress = ellipticCompress;
function ellipticDecompress(publicKey) {
    publicKey = helpers_1.sanitizePublicKey(publicKey);
    const pubPoint = ec.keyFromPublic(publicKey);
    const hex = pubPoint.getPublic().encode(constants_1.HEX_ENC, false);
    return helpers_1.hexToBuffer(hex);
}
exports.ellipticDecompress = ellipticDecompress;
function ellipticGeneratePrivate() {
    let privateKey = random_1.randomBytes(constants_1.KEY_LENGTH);
    while (!ellipticVerifyPrivateKey(privateKey)) {
        privateKey = random_1.randomBytes(constants_1.KEY_LENGTH);
    }
    return privateKey;
}
exports.ellipticGeneratePrivate = ellipticGeneratePrivate;
function ellipticVerifyPrivateKey(privateKey) {
    return helpers_1.isValidPrivateKey(privateKey);
}
exports.ellipticVerifyPrivateKey = ellipticVerifyPrivateKey;
function ellipticGetPublic(privateKey) {
    const hex = ec.keyFromPrivate(privateKey).getPublic(false, constants_1.HEX_ENC);
    return helpers_1.hexToBuffer(hex);
}
exports.ellipticGetPublic = ellipticGetPublic;
function ellipticGetPublicCompressed(privateKey) {
    const hex = ec.keyFromPrivate(privateKey).getPublic(true, constants_1.HEX_ENC);
    return helpers_1.hexToBuffer(hex);
}
exports.ellipticGetPublicCompressed = ellipticGetPublicCompressed;
function ellipticDerive(publicKeyB, privateKeyA) {
    const keyA = ec.keyFromPrivate(privateKeyA);
    const keyB = ec.keyFromPublic(publicKeyB);
    const Px = keyA.derive(keyB.getPublic());
    return Buffer.from(Px.toArray());
}
exports.ellipticDerive = ellipticDerive;
function ellipticSignatureExport(sig) {
    return signature_1.Signature({
        r: sig.slice(0, 32),
        s: sig.slice(32, 64),
        recoveryParam: helpers_1.importRecoveryParam(sig.slice(64, 65)),
    }).toDER();
}
exports.ellipticSignatureExport = ellipticSignatureExport;
function ellipticSign(msg, privateKey, rsvSig = false) {
    const signature = ec.sign(msg, privateKey, { canonical: true });
    return rsvSig
        ? ellipticRSVSignature(signature)
        : Buffer.from(signature.toDER());
}
exports.ellipticSign = ellipticSign;
function ellipticRecover(sig, msg, compressed = false) {
    if (helpers_1.isValidDERSignature(sig)) {
        throw new Error('Cannot recover from DER signatures');
    }
    const signature = helpers_1.splitSignature(sig);
    const recoveryParam = helpers_1.importRecoveryParam(signature.v);
    const hex = ec
        .recoverPubKey(msg, {
        r: helpers_1.removeHexLeadingZeros(helpers_1.bufferToHex(signature.r)),
        s: helpers_1.removeHexLeadingZeros(helpers_1.bufferToHex(signature.s)),
        recoveryParam,
    }, recoveryParam)
        .encode(constants_1.HEX_ENC, compressed);
    return helpers_1.hexToBuffer(hex);
}
exports.ellipticRecover = ellipticRecover;
function ellipticVerify(sig, msg, publicKey) {
    if (!helpers_1.isValidDERSignature) {
        sig = ellipticSignatureExport(sig);
    }
    return ec.verify(msg, sig, publicKey);
}
exports.ellipticVerify = ellipticVerify;
//# sourceMappingURL=index.js.map