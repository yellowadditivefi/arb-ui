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
exports.sendIsAlive = void 0;
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
function sendIsAlive(mySigner, messaging, store, chainService, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        const method = "sendIsAlive";
        const channels = yield store.getChannelStates();
        const providers = chainService.getChainProviders();
        if (providers.isError) {
            logger.error(Object.assign(Object.assign({}, providers.getError()), { method }), "Error getting chain providers");
            return;
        }
        const supportedChains = Object.keys(providers.getValue()).map((chain) => parseInt(chain));
        logger.info({ method, numChannels: channels.length }, "Sending check-in messages");
        yield Promise.all(channels.map((channel) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!supportedChains.includes(channel.networkContext.chainId)) {
                logger.debug({ chainId: channel.networkContext.chainId, supportedChains, method, channelAddress: channel.channelAddress }, "Channel chain not supported, skipping");
                return;
            }
            const participant = vector_utils_1.getParticipant(channel, mySigner.publicIdentifier);
            if (!participant) {
                logger.error({ participant, alice: channel.aliceIdentifier, bob: channel.bobIdentifier, channel: channel.channelAddress }, "Signer not in channel");
                return;
            }
            const counterpartyIdentifier = participant === "alice" ? channel.bobIdentifier : channel.aliceIdentifier;
            const res = yield messaging.sendIsAliveMessage(vector_types_1.Result.ok({ channelAddress: channel.channelAddress }), counterpartyIdentifier, mySigner.publicIdentifier);
            if (res.isError) {
                logger.error({
                    method,
                    counterpartyIdentifier,
                    channel: channel.channelAddress,
                    error: (_a = res.getError()) === null || _a === void 0 ? void 0 : _a.message,
                    context: (_b = res.getError()) === null || _b === void 0 ? void 0 : _b.context,
                }, "Error sending checkIn message");
            }
            else {
                logger.info({ method, counterpartyIdentifier, channel: channel.channelAddress, result: res.getValue() }, "Successfully sent checkIn message");
            }
        })));
    });
}
exports.sendIsAlive = sendIsAlive;
//# sourceMappingURL=isAlive.js.map