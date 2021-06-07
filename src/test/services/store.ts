"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStoreService = void 0;
class MemoryStoreService {
    constructor() {
        this.transfersInChannel = new Map();
        this.transfers = new Map();
        this.channelStates = new Map();
        this.schemaVersion = undefined;
        this.transferDisputes = new Map();
        this.channelDisputes = new Map();
    }
    getWithdrawalCommitmentByTransactionHash(transactionHash) {
        throw new Error("Method not implemented.");
    }
    saveChannelDispute(channel, channelDispute, transferDispute) {
        this.channelDisputes.set(channel.channelAddress, channelDispute);
        const existing = this.channelStates.get(channel.channelAddress);
        if (existing) {
            this.channelStates.set(channel.channelAddress, Object.assign(Object.assign({}, existing), { inDispute: channel.inDispute }));
        }
        if (transferDispute && this.transfers.has(transferDispute.transferId)) {
            this.transferDisputes.set(transferDispute.transferId, transferDispute);
            const t = this.transfers.get(transferDispute.transferId);
            this.transfers.set(t.transferId, Object.assign(Object.assign({}, t), { inDispute: true }));
        }
        return Promise.resolve();
    }
    getTransactionByHash(transactionHash) {
        return Promise.resolve(undefined);
    }
    saveTransactionFailure(channelAddress, transactionHash, error) {
        return Promise.resolve(undefined);
    }
    saveTransactionReceipt(channelAddress, transaction) {
        return Promise.resolve(undefined);
    }
    saveTransactionResponse(channelAddress, transactionReason, response) {
        return Promise.resolve(undefined);
    }
    connect() {
        return Promise.resolve();
    }
    disconnect() {
        return Promise.resolve();
    }
    clear() {
        this.channelStates.clear();
        this.transfersInChannel.clear();
        this.transfers.clear();
        return Promise.resolve();
    }
    getChannelState(channelAddress) {
        const state = this.channelStates.get(channelAddress);
        return Promise.resolve(state);
    }
    getChannelStateByParticipants(participantA, participantB, chainId) {
        return Promise.resolve([...this.channelStates.values()].find((channelState) => {
            channelState.alice === participantA &&
                channelState.bob === participantB &&
                channelState.networkContext.chainId === chainId;
        }));
    }
    getChannelStates() {
        return Promise.resolve([...this.channelStates.values()]);
    }
    saveChannelState(channelState, transfer) {
        var _a;
        this.channelStates.set(channelState.channelAddress, Object.assign({}, channelState));
        if (!transfer) {
            return Promise.resolve();
        }
        this.transfers.set(transfer.transferId, transfer);
        const activeTransfers = (_a = this.transfersInChannel.get(channelState.channelAddress)) !== null && _a !== void 0 ? _a : [];
        if (transfer.transferResolver) {
            this.transfersInChannel.set(channelState.channelAddress, activeTransfers.filter((x) => x !== transfer.transferId));
            return Promise.resolve();
        }
        this.transfersInChannel.set(channelState.channelAddress, [...activeTransfers, transfer.transferId]);
        return Promise.resolve();
    }
    saveChannelStateAndTransfers(channelState, activeTransfers) {
        return Promise.reject("Method not implemented");
    }
    getActiveTransfers(channelAddress) {
        var _a;
        const active = [...((_a = this.transfersInChannel.get(channelAddress)) !== null && _a !== void 0 ? _a : [])];
        const all = active.map((id) => this.transfers.get(id)).filter((x) => !!x);
        return Promise.resolve(all);
    }
    getTransferState(transferId) {
        return Promise.resolve(this.transfers.get(transferId));
    }
    getTransfersByRoutingId(routingId) {
        throw new Error("getTransfersByRoutingId not implemented.");
    }
    getTransfers(filterOpts) {
        throw new Error("Method not implemented.");
    }
    getSchemaVersion() {
        return Promise.resolve(this.schemaVersion);
    }
    updateSchemaVersion(version) {
        this.schemaVersion = version;
        return Promise.resolve();
    }
    getWithdrawalCommitment(transferId) {
        return Promise.resolve(undefined);
    }
    saveWithdrawalCommitment(transferId, withdrawCommitment) {
        return Promise.resolve();
    }
    getTransferByRoutingId(channelAddress, routingId) {
        return Promise.resolve(undefined);
    }
}
exports.MemoryStoreService = MemoryStoreService;
//# sourceMappingURL=store.js.map