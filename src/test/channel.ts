"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestChannelUpdateWithSigners = exports.createTestChannelStateWithSigners = exports.createTestChannelState = exports.createTestChannelUpdate = exports.createTestUpdateParams = void 0;
const vector_types_1 = require("@connext/vector-types");
const transfers_1 = require("./transfers");
const util_1 = require("./util");
function createTestUpdateParams(type, overrides = {}) {
    var _a;
    const base = {
        channelAddress: (_a = overrides.channelAddress) !== null && _a !== void 0 ? _a : util_1.mkAddress("0xccc"),
        type,
    };
    let details;
    switch (type) {
        case vector_types_1.UpdateType.setup:
            details = {
                counterpartyIdentifier: util_1.mkPublicIdentifier("vectorBdea4"),
                timeout: "1200",
                networkContext: {
                    chainId: 2,
                    channelFactoryAddress: util_1.mkAddress("0xccccddddaaaaaffff"),
                    transferRegistryAddress: util_1.mkAddress("0xdddeffff2222"),
                },
            };
            break;
        case vector_types_1.UpdateType.deposit:
            details = {
                channelAddress: base.channelAddress,
                assetId: util_1.mkAddress(),
            };
            break;
        case vector_types_1.UpdateType.create:
            details = {
                channelAddress: base.channelAddress,
                balance: { to: [util_1.mkAddress("0x111"), util_1.mkAddress("0x222")], amount: ["15", "0"] },
                assetId: util_1.mkAddress("0x0"),
                transferDefinition: util_1.mkAddress("0xdef"),
                transferInitialState: transfers_1.createTestHashlockTransferState(),
                timeout: "1",
                meta: { test: "meta" },
            };
            break;
        case vector_types_1.UpdateType.resolve:
            details = {
                channelAddress: base.channelAddress,
                transferId: util_1.mkBytes32("0xabcdef"),
                transferResolver: { preImage: util_1.mkBytes32("0xcdef") },
                meta: { test: "meta" },
            };
            break;
    }
    const { details: detailOverrides } = overrides, defaultOverrides = __rest(overrides, ["details"]);
    return Object.assign(Object.assign(Object.assign({}, base), { details: Object.assign(Object.assign(Object.assign({}, details), { channelAddress: base.channelAddress }), (detailOverrides !== null && detailOverrides !== void 0 ? detailOverrides : {})) }), defaultOverrides);
}
exports.createTestUpdateParams = createTestUpdateParams;
function createTestChannelUpdate(type, overrides = {}) {
    const baseUpdate = {
        assetId: util_1.mkAddress("0x0"),
        balance: {
            amount: ["1", "0"],
            to: [util_1.mkAddress("0xaaa"), util_1.mkAddress("0xbbb")],
        },
        channelAddress: util_1.mkAddress("0xccc"),
        fromIdentifier: util_1.mkPublicIdentifier("vectorA"),
        nonce: 1,
        aliceSignature: util_1.mkSig("0x0001"),
        bobSignature: util_1.mkSig("0x0002"),
        toIdentifier: util_1.mkPublicIdentifier("vectorB"),
        type,
    };
    const { details: detailOverrides } = overrides, defaultOverrides = __rest(overrides, ["details"]);
    let details;
    switch (type) {
        case vector_types_1.UpdateType.setup:
            details = {
                networkContext: {
                    chainId: 1337,
                    channelFactoryAddress: util_1.mkAddress("0xccccddddaaaaaffff"),
                    transferRegistryAddress: util_1.mkAddress("0xffffeeeeeecccc"),
                },
                timeout: "1",
            };
            break;
        case vector_types_1.UpdateType.deposit:
            details = {
                totalDepositsAlice: "10",
                totalDepositsBob: "5",
            };
            break;
        case vector_types_1.UpdateType.create:
            const createDeets = {
                merkleProofData: [util_1.mkBytes32("0xproof")],
                merkleRoot: util_1.mkBytes32("0xeeeeaaaaa333344444"),
                transferDefinition: util_1.mkAddress("0xdef"),
                transferId: util_1.mkBytes32("0xaaaeee"),
                transferEncodings: ["state", "resolver"],
                balance: { to: [util_1.mkAddress("0x111"), util_1.mkAddress("0x222")], amount: ["7", "0"] },
                transferInitialState: {
                    lockHash: util_1.mkBytes32("0xlockHash"),
                    expiry: "0",
                },
                transferTimeout: vector_types_1.DEFAULT_TRANSFER_TIMEOUT.toString(),
            };
            details = Object.assign({}, createDeets);
            break;
        case vector_types_1.UpdateType.resolve:
            const resolveDetails = {
                merkleRoot: util_1.mkBytes32("0xeeeaaa32333"),
                transferDefinition: util_1.mkAddress("0xdef"),
                transferId: util_1.mkBytes32("0xeee3332222111"),
                transferResolver: { preImage: util_1.mkBytes32("0xpre") },
            };
            details = Object.assign({}, resolveDetails);
            break;
    }
    return Object.assign(Object.assign(Object.assign({}, baseUpdate), { details: Object.assign(Object.assign({}, details), (detailOverrides !== null && detailOverrides !== void 0 ? detailOverrides : {})) }), (defaultOverrides !== null && defaultOverrides !== void 0 ? defaultOverrides : {}));
}
exports.createTestChannelUpdate = createTestChannelUpdate;
function createTestChannelState(type, overrides = {}, transferOverrides = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const publicIdentifiers = [
        (_a = overrides.aliceIdentifier) !== null && _a !== void 0 ? _a : util_1.mkPublicIdentifier("vectorA"),
        (_b = overrides.bobIdentifier) !== null && _b !== void 0 ? _b : util_1.mkPublicIdentifier("vectorB"),
    ];
    const participants = [(_c = overrides.alice) !== null && _c !== void 0 ? _c : util_1.mkAddress("0xaaa"), (_d = overrides.bob) !== null && _d !== void 0 ? _d : util_1.mkAddress("0xbbb")];
    const channelAddress = (_e = overrides.channelAddress) !== null && _e !== void 0 ? _e : util_1.mkAddress("0xccc");
    const assetIds = (_f = overrides.assetIds) !== null && _f !== void 0 ? _f : [util_1.mkAddress("0x0"), util_1.mkAddress("0x1")];
    const nonce = (_g = overrides.nonce) !== null && _g !== void 0 ? _g : 1;
    const defundNonces = (_h = overrides.defundNonces) !== null && _h !== void 0 ? _h : ["1", "1"];
    const { latestUpdate: latestUpdateOverrides, networkContext: networkContextOverride, inDispute: inDisputeOverride } = overrides, rest = __rest(overrides, ["latestUpdate", "networkContext", "inDispute"]);
    const latestUpdate = createTestChannelUpdate(type, Object.assign({ channelAddress, fromIdentifier: publicIdentifiers[0], toIdentifier: publicIdentifiers[1], assetId: assetIds[0], nonce }, latestUpdateOverrides));
    latestUpdate.details = Object.assign(Object.assign({}, latestUpdate.details), transferOverrides);
    const networkContext = type === vector_types_1.UpdateType.setup
        ? Object.assign({}, latestUpdate.details.networkContext) : Object.assign({ chainId: 1337, channelFactoryAddress: util_1.mkAddress("0xccccddddaaaaaffff"), transferRegistryAddress: util_1.mkAddress("0xcc22233323132") }, (networkContextOverride !== null && networkContextOverride !== void 0 ? networkContextOverride : {}));
    const inDispute = inDisputeOverride !== null && inDisputeOverride !== void 0 ? inDisputeOverride : false;
    let transfer;
    if (type === "create" || type === "resolve") {
        transfer = transfers_1.createTestFullHashlockTransferState();
        transfer.balance = (_j = latestUpdate.balance) !== null && _j !== void 0 ? _j : transfer.balance;
        transfer.meta = type === "create" ? latestUpdate.details.meta : undefined;
        latestUpdate.details.meta =
            type === "create" ? latestUpdate.details.meta : undefined;
        transfer.channelFactoryAddress = (_k = networkContext.channelFactoryAddress) !== null && _k !== void 0 ? _k : transfer.channelFactoryAddress;
        transfer.inDispute = inDispute !== null && inDispute !== void 0 ? inDispute : transfer.inDispute;
        transfer.initiator = latestUpdate.fromIdentifier === publicIdentifiers[0] ? participants[0] : participants[1];
        transfer.responder = latestUpdate.toIdentifier === publicIdentifiers[0] ? participants[0] : participants[1];
        transfer.initiatorIdentifier =
            latestUpdate.fromIdentifier === publicIdentifiers[0] ? publicIdentifiers[0] : publicIdentifiers[1];
        transfer.responderIdentifier =
            latestUpdate.toIdentifier === publicIdentifiers[0] ? publicIdentifiers[0] : publicIdentifiers[1];
        transfer.transferDefinition = (_l = latestUpdate.details.transferDefinition) !== null && _l !== void 0 ? _l : transfer.transferDefinition;
        transfer.transferEncodings = (_m = latestUpdate.details.transferEncodings) !== null && _m !== void 0 ? _m : transfer.transferEncodings;
        transfer.initialStateHash = (_o = transferOverrides.initialStateHash) !== null && _o !== void 0 ? _o : transfer.initialStateHash;
        transfer.transferId = (_p = latestUpdate.details.transferId) !== null && _p !== void 0 ? _p : transfer.transferId;
        transfer.transferResolver =
            type === "resolve" ? latestUpdate.details.transferResolver : undefined;
        transfer.transferState = (_q = latestUpdate.details.transferInitialState) !== null && _q !== void 0 ? _q : transfer.transferState;
        transfer.transferTimeout = (_r = latestUpdate.details.transferTimeout) !== null && _r !== void 0 ? _r : transfer.transferTimeout;
        transfer.chainId = networkContext.chainId;
        transfer.channelAddress = channelAddress;
    }
    return {
        channel: Object.assign({ assetIds, balances: [
                {
                    amount: ["1", "2"],
                    to: [...participants],
                },
                {
                    amount: ["1", "2"],
                    to: [...participants],
                },
            ], processedDepositsA: ["1", "2"], processedDepositsB: ["1", "2"], channelAddress,
            latestUpdate, merkleRoot: util_1.mkHash(), networkContext,
            nonce, alice: participants[0], bob: participants[1], aliceIdentifier: publicIdentifiers[0], bobIdentifier: publicIdentifiers[1], timeout: "1", defundNonces,
            inDispute }, rest),
        transfer,
    };
}
exports.createTestChannelState = createTestChannelState;
function createTestChannelStateWithSigners(signers, type, overrides = {}) {
    const signerOverrides = Object.assign({ aliceIdentifier: signers[0].publicIdentifier, bobIdentifier: signers[1].publicIdentifier, alice: signers[0].address, bob: signers[1].address }, (overrides !== null && overrides !== void 0 ? overrides : {}));
    return createTestChannelState(type, signerOverrides).channel;
}
exports.createTestChannelStateWithSigners = createTestChannelStateWithSigners;
function createTestChannelUpdateWithSigners(signers, type, overrides = {}) {
    var _a, _b;
    const details = {};
    if (type === vector_types_1.UpdateType.create) {
        details.transferInitialState = transfers_1.createTestHashlockTransferState(Object.assign({}, ((_b = (_a = overrides.details) === null || _a === void 0 ? void 0 : _a.transferInitialState) !== null && _b !== void 0 ? _b : {})));
    }
    const signerOverrides = Object.assign({ balance: {
            to: signers.map((s) => s.address),
            amount: ["1", "0"],
        }, fromIdentifier: signers[0].publicIdentifier, toIdentifier: signers[1].publicIdentifier }, (overrides !== null && overrides !== void 0 ? overrides : {}));
    return createTestChannelUpdate(type, signerOverrides);
}
exports.createTestChannelUpdateWithSigners = createTestChannelUpdateWithSigners;
//# sourceMappingURL=channel.js.map