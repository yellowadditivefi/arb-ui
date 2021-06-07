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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserStore = void 0;
const vector_types_1 = require("@connext/vector-types");
const dexie_1 = __importDefault(require("dexie"));
const storedTransferToTransferState = (stored) => {
    const transfer = stored;
    delete transfer.createUpdateNonce;
    delete transfer.resolveUpdateNonce;
    delete transfer.routingId;
    delete transfer.createdAt;
    return transfer;
};
const getStoreName = (publicIdentifier) => {
    return `${publicIdentifier}-store`;
};
const NON_NAMESPACED_STORE = "VectorIndexedDBDatabase";
class VectorIndexedDBDatabase extends dexie_1.default {
    constructor(name, indexedDB, idbKeyRange) {
        let options;
        if (indexedDB && idbKeyRange) {
            options = { indexedDB, IDBKeyRange: idbKeyRange };
        }
        super(name, options);
        this.version(1).stores({
            channels: "channelAddress, [aliceIdentifier+bobIdentifier+networkContext.chainId], [alice+bob+networkContext.chainId]",
            transfers: "transferId, [routingId+channelAddress], [createUpdateNonce+channelAddress], [resolveUpdateNonce+channelAddress], [transferResolver+channelAddress]",
            transactions: "transactionHash",
            withdrawCommitment: "transferId",
            values: "key",
        });
        this.version(2)
            .stores({
            channels: "channelAddress, [aliceIdentifier+bobIdentifier+networkContext.chainId], [alice+bob+networkContext.chainId], createdAt",
            transfers: "transferId, [routingId+channelAddress], [createUpdateNonce+channelAddress], [resolveUpdateNonce+channelAddress], [transferResolver+channelAddress], createdAt, resolveUpdateNonce, channelAddress",
        })
            .upgrade((tx) => {
            tx.table("channels")
                .toCollection()
                .modify((channel) => {
                channel.createdAt = new Date();
            });
            tx.table("transfers")
                .toCollection()
                .modify((transfer) => {
                transfer.createdAt = new Date();
            });
        });
        this.version(3).stores({
            withdrawCommitment: "transferId,transactionHash",
        });
        this.channels = this.table("channels");
        this.transfers = this.table("transfers");
        this.transactions = this.table("transactions");
        this.withdrawCommitment = this.table("withdrawCommitment");
        this.values = this.table("values");
        this.name = name;
    }
}
class BrowserStore {
    constructor(dbName, log, indexedDB, idbKeyRange) {
        this.dbName = dbName;
        this.log = log;
        this.db = new VectorIndexedDBDatabase(dbName, indexedDB, idbKeyRange);
    }
    saveChannelDispute(channel, channelDispute, transferDispute) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.channels.update(channel.channelAddress, { inDispute: channel.inDispute });
            if (transferDispute) {
                yield this.db.transfers.update(transferDispute.transferId, { inDispute: true });
            }
        });
    }
    static create(publicIdentifer, log, indexedDB, idbKeyRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = (yield dexie_1.default.exists(NON_NAMESPACED_STORE)) ? NON_NAMESPACED_STORE : getStoreName(publicIdentifer);
            const store = new BrowserStore(name, log, indexedDB, idbKeyRange);
            yield store.connect();
            return store;
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.open();
        });
    }
    disconnect() {
        return Promise.resolve(this.db.close());
    }
    getSchemaVersion() {
        return Promise.resolve(1);
    }
    updateSchemaVersion(version) {
        throw new Error("Method not implemented.");
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.channels.clear();
            yield this.db.transfers.clear();
            yield this.db.transactions.clear();
        });
    }
    saveChannelStateAndTransfers(channelState, activeTransfers) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.transaction("rw", this.db.channels, this.db.transfers, () => __awaiter(this, void 0, void 0, function* () {
                const currActive = yield this.getActiveTransfers(channelState.channelAddress);
                yield this.db.transfers.bulkDelete(currActive.map((t) => t.transferId));
                yield this.db.channels.put(channelState);
                yield this.db.transfers.bulkPut(activeTransfers.map((transfer) => {
                    var _a;
                    return Object.assign(Object.assign({}, transfer), { createUpdateNonce: transfer.channelNonce + 1, resolveUpdateNonce: 0, routingId: (_a = transfer === null || transfer === void 0 ? void 0 : transfer.meta) === null || _a === void 0 ? void 0 : _a.routingId, createdAt: new Date() });
                }));
            }));
        });
    }
    saveChannelState(channelState, transfer) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.transaction("rw", this.db.channels, this.db.transfers, () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                yield this.db.channels.put(channelState);
                if (channelState.latestUpdate.type === vector_types_1.UpdateType.create) {
                    yield this.db.transfers.put(Object.assign(Object.assign({}, transfer), { createUpdateNonce: channelState.latestUpdate.nonce, resolveUpdateNonce: 0, routingId: (_a = transfer === null || transfer === void 0 ? void 0 : transfer.meta) === null || _a === void 0 ? void 0 : _a.routingId, createdAt: new Date() }));
                }
                else if (channelState.latestUpdate.type === vector_types_1.UpdateType.resolve) {
                    yield this.db.transfers.update(channelState.latestUpdate.details.transferId, {
                        resolveUpdateNonce: channelState.latestUpdate.nonce,
                        transferResolver: channelState.latestUpdate.details.transferResolver,
                    });
                }
            }));
        });
    }
    getChannelStates() {
        return __awaiter(this, void 0, void 0, function* () {
            const channels = yield this.db.channels.toArray();
            return channels;
        });
    }
    getChannelState(channelAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = yield this.db.channels.get(channelAddress);
            return channel;
        });
    }
    getChannelStateByParticipants(publicIdentifierA, publicIdentifierB, chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = yield this.db.channels
                .where("[aliceIdentifier+bobIdentifier+networkContext.chainId]")
                .equals([publicIdentifierA, publicIdentifierB, chainId])
                .or("[aliceIdentifier+bobIdentifier+networkContext.chainId]")
                .equals([publicIdentifierB, publicIdentifierA, chainId])
                .first();
            return channel;
        });
    }
    getActiveTransfers(channelAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = this.db.transfers.where("[resolveUpdateNonce+channelAddress]").equals([0, channelAddress]);
            const transfers = yield collection.toArray();
            return transfers.map(storedTransferToTransferState);
        });
    }
    getTransferState(transferId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transfer = yield this.db.transfers.get(transferId);
            return transfer ? storedTransferToTransferState(transfer) : undefined;
        });
    }
    getTransferByRoutingId(channelAddress, routingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transfer = yield this.db.transfers.get({ channelAddress, routingId });
            return transfer ? storedTransferToTransferState(transfer) : undefined;
        });
    }
    getTransfersByRoutingId(routingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const transfers = this.db.transfers.where({ routingId });
            const ret = yield transfers.toArray();
            return ret.map(storedTransferToTransferState);
        });
    }
    getTransfers(filterOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            const filterQuery = [];
            if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.channelAddress) {
                filterQuery.push({ index: "channelAddress", function: "equals", params: filterOpts.channelAddress });
            }
            if ((filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.startDate) && filterOpts.endDate) {
                filterQuery.push({ index: "channelAddress", function: "between", params: filterOpts.channelAddress });
            }
            else if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.startDate) {
                filterQuery.push({ index: "channelAddress", function: "equals", params: filterOpts.channelAddress });
            }
            else if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.endDate) {
                filterQuery.push({ index: "channelAddress", function: "equals", params: filterOpts.channelAddress });
            }
            let collection = this.db.transfers.toCollection();
            if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.channelAddress) {
                collection = collection.filter((transfer) => transfer.channelAddress === filterOpts.channelAddress);
            }
            if ((filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.startDate) && filterOpts.endDate) {
                collection = collection.filter((transfer) => transfer.createdAt >= filterOpts.startDate && transfer.createdAt <= filterOpts.endDate);
            }
            else if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.startDate) {
                collection = collection.filter((transfer) => transfer.createdAt >= filterOpts.startDate);
            }
            else if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.endDate) {
                collection = collection.filter((transfer) => transfer.createdAt <= filterOpts.endDate);
            }
            if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.active) {
                collection = collection.filter((transfer) => transfer.resolveUpdateNonce === 0);
            }
            if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.routingId) {
                collection = collection.filter((transfer) => transfer.routingId === filterOpts.routingId);
            }
            if (filterOpts === null || filterOpts === void 0 ? void 0 : filterOpts.transferDefinition) {
                collection = collection.filter((transfer) => transfer.transferDefinition === filterOpts.transferDefinition);
            }
            const transfers = yield collection.toArray();
            return transfers.map(storedTransferToTransferState);
        });
    }
    saveTransactionResponse(channelAddress, reason, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.transactions.put({
                channelAddress,
                status: vector_types_1.StoredTransactionStatus.submitted,
                reason,
                to: transaction.to,
                from: transaction.from,
                data: transaction.data,
                value: transaction.value.toString(),
                chainId: transaction.chainId,
                nonce: transaction.nonce,
                gasLimit: transaction.gasLimit.toString(),
                gasPrice: transaction.gasPrice.toString(),
                transactionHash: transaction.hash,
                timestamp: transaction.timestamp,
                raw: transaction.raw,
                blockHash: transaction.blockHash,
                blockNumber: transaction.blockNumber,
            });
        });
    }
    saveTransactionReceipt(channelAddress, transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.transactions.update(transaction.transactionHash, {
                status: vector_types_1.StoredTransactionStatus.mined,
                logs: transaction.logs,
                contractAddress: transaction.contractAddress,
                transactionIndex: transaction.transactionIndex,
                root: transaction.root,
                gasUsed: transaction.gasUsed.toString(),
                logsBloom: transaction.logsBloom,
                cumulativeGasUsed: transaction.cumulativeGasUsed.toString(),
                byzantium: transaction.byzantium,
            });
        });
    }
    saveTransactionFailure(channelAddress, transactionHash, error) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.transactions.update(transactionHash, {
                status: vector_types_1.StoredTransactionStatus.failed,
                error,
            });
        });
    }
    getTransactionByHash(transactionHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield this.db.transactions.get(transactionHash);
            return tx;
        });
    }
    saveWithdrawalCommitment(transferId, withdrawCommitment) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.withdrawCommitment.put(Object.assign(Object.assign({}, withdrawCommitment), { transferId }));
        });
    }
    getWithdrawalCommitment(transferId) {
        return __awaiter(this, void 0, void 0, function* () {
            const w = yield this.db.withdrawCommitment.get(transferId);
            if (!w) {
                return w;
            }
            const { transferId: t } = w, commitment = __rest(w, ["transferId"]);
            return commitment;
        });
    }
    getWithdrawalCommitmentByTransactionHash(transactionHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const w = yield this.db.withdrawCommitment.get({ transactionHash });
            if (!w) {
                return w;
            }
            const { transferId } = w, commitment = __rest(w, ["transferId"]);
            return commitment;
        });
    }
}
exports.BrowserStore = BrowserStore;
//# sourceMappingURL=store.js.map