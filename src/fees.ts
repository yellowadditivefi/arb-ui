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
exports.getExchangeRateInEth = exports.normalizeFee = exports.TESTNETS_WITH_FEES = exports.FeeCalculationError = void 0;
const vector_types_1 = require("@connext/vector-types");
const bignumber_1 = require("@ethersproject/bignumber");
const constants_1 = require("@ethersproject/constants");
const axios_1 = __importDefault(require("axios"));
const error_1 = require("./error");
const hexStrings_1 = require("./hexStrings");
const math_1 = require("./math");
class FeeCalculationError extends vector_types_1.VectorError {
    constructor(message, context = {}) {
        super(message, context, FeeCalculationError.type);
        this.message = message;
    }
}
exports.FeeCalculationError = FeeCalculationError;
FeeCalculationError.type = "FeeCalculationError";
FeeCalculationError.reasons = {
    ChainError: "Error reading the chain",
    ExchangeRateError: "Error getting exchange rate",
};
exports.TESTNETS_WITH_FEES = [4, 5, 42, 80001, 1337, 1338];
exports.normalizeFee = (fee, baseAssetDecimals, desiredFeeAssetId, desiredFeeAssetDecimals, chainId, ethReader, logger, gasPriceOverride) => __awaiter(void 0, void 0, void 0, function* () {
    const method = "normalizeFee";
    const methodId = hexStrings_1.getRandomBytes32();
    logger.info({ method, methodId, fee: fee.toString(), toAssetId: desiredFeeAssetId, toChainId: chainId }, "Method start");
    if (chainId !== 1 && !exports.TESTNETS_WITH_FEES.includes(chainId)) {
        return vector_types_1.Result.fail(new FeeCalculationError(FeeCalculationError.reasons.ChainError, {
            message: "Cannot get normalize fees that are not going to mainnet",
            toAssetId: desiredFeeAssetId,
            toChainId: chainId,
            fee: fee.toString(),
        }));
    }
    let gasPrice = gasPriceOverride;
    if (!gasPriceOverride) {
        const gasPriceRes = yield ethReader.getGasPrice(chainId);
        if (gasPriceRes.isError) {
            return vector_types_1.Result.fail(new FeeCalculationError(FeeCalculationError.reasons.ChainError, {
                getGasPriceError: vector_types_1.jsonifyError(gasPriceRes.getError()),
            }));
        }
        gasPrice = gasPriceRes.getValue();
    }
    const feeWithGasPrice = fee.mul(gasPrice);
    if (desiredFeeAssetId === constants_1.AddressZero) {
        logger.info({ method, methodId }, "Eth detected, exchange rate not required");
        return vector_types_1.Result.ok(feeWithGasPrice);
    }
    const exchangeRateRes = exports.TESTNETS_WITH_FEES.includes(chainId)
        ? vector_types_1.Result.ok(0.01)
        : yield exports.getExchangeRateInEth(desiredFeeAssetId, logger);
    if (exchangeRateRes.isError) {
        return vector_types_1.Result.fail(exchangeRateRes.getError());
    }
    const exchangeRate = exchangeRateRes.getValue();
    const invertedRate = math_1.inverse(exchangeRate.toString());
    const feeWithGasPriceInAsset = math_1.calculateExchangeWad(feeWithGasPrice, baseAssetDecimals, invertedRate, desiredFeeAssetDecimals);
    return vector_types_1.Result.ok(bignumber_1.BigNumber.from(feeWithGasPriceInAsset));
});
exports.getExchangeRateInEth = (tokenAddress, logger) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const uri = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=eth`;
    logger.info({ uri }, "Getting exchange rate");
    try {
        const response = yield axios_1.default.get(uri);
        logger.info({ uri, response: response.data }, "Got exchange rate");
        if (!((_a = response.data[tokenAddress]) === null || _a === void 0 ? void 0 : _a.eth) && !((_b = response.data[tokenAddress.toLowerCase()]) === null || _b === void 0 ? void 0 : _b.eth)) {
            return vector_types_1.Result.fail(new FeeCalculationError(FeeCalculationError.reasons.ExchangeRateError, {
                message: "Could not find rate in response",
                response: response.data,
                tokenAddress,
            }));
        }
        return vector_types_1.Result.ok((_d = (_c = response.data[tokenAddress]) === null || _c === void 0 ? void 0 : _c.eth) !== null && _d !== void 0 ? _d : (_e = response.data[tokenAddress.toLowerCase()]) === null || _e === void 0 ? void 0 : _e.eth);
    }
    catch (e) {
        error_1.logAxiosError(logger, e);
        return vector_types_1.Result.fail(new FeeCalculationError(FeeCalculationError.reasons.ExchangeRateError, {
            message: "Could not get exchange rate",
            tokenAddress,
            error: e.message,
        }));
    }
});
//# sourceMappingURL=fees.js.map