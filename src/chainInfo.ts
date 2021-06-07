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
exports.getAssetDecimals = exports.getAssetName = exports.getChainInfo = exports.CHAIN_INFO_URL = void 0;
const web_1 = require("@ethersproject/web");
const vector_types_1 = require("@connext/vector-types");
const contracts_1 = require("@ethersproject/contracts");
const constants_1 = require("@ethersproject/constants");
const chains_json_1 = __importDefault(require("./chains.json"));
exports.CHAIN_INFO_URL = "https://chainid.network/chains.json";
exports.getChainInfo = (chainId) => __awaiter(void 0, void 0, void 0, function* () {
    let chain = chains_json_1.default[0];
    try {
        chain = chains_json_1.default.find((info) => info.chainId === chainId);
        if (chain.chainId === 0) {
            const chainInfo = yield web_1.fetchJson(exports.CHAIN_INFO_URL);
            chain = chainInfo.find((info) => info.chainId === chainId);
        }
    }
    catch (e) { }
    return chain;
});
exports.getAssetName = (chainId, assetId) => {
    var _a;
    const chain = chains_json_1.default.find((info) => info.chainId === chainId);
    if (chain) {
        return chain.assetId[assetId] ? (_a = chain.assetId[assetId]) !== null && _a !== void 0 ? _a : "Token" : "Token";
    }
    else {
        return "Token";
    }
};
exports.getAssetDecimals = (assetId, ethProvider) => __awaiter(void 0, void 0, void 0, function* () {
    let decimals = 18;
    if (assetId !== constants_1.AddressZero) {
        try {
            const token = new contracts_1.Contract(assetId, vector_types_1.ERC20Abi, ethProvider);
            decimals = yield token.decimals();
        }
        catch (e) {
            console.warn(`Error detecting decimals, unsafely falling back to 18 decimals for ${assetId}`);
        }
    }
    return decimals;
});
//# sourceMappingURL=chainInfo.js.map