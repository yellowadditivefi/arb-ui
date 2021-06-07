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
exports.DirectProvider = exports.IframeChannelProvider = exports.renderElement = exports.isMethodName = exports.isEventName = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const vector_types_1 = require("@connext/vector-types");
const vector_utils_1 = require("@connext/vector-utils");
function isEventName(event) {
    return event in vector_types_1.EngineEvents;
}
exports.isEventName = isEventName;
function isMethodName(event) {
    return event in vector_types_1.ChannelRpcMethods;
}
exports.isMethodName = isMethodName;
function renderElement(name, attr, target) {
    const elm = document.createElement(name);
    Object.keys(attr).forEach((key) => {
        elm[key] = attr[key];
    });
    target.appendChild(elm);
    return elm;
}
exports.renderElement = renderElement;
class IframeChannelProvider extends eventemitter3_1.default {
    constructor(opts) {
        super();
        this.opts = opts;
        this.connected = false;
        this.subscribed = false;
        this.events = new eventemitter3_1.default();
        this.removeAllListeners = () => {
            this.events.removeAllListeners();
            const rpc = vector_utils_1.constructRpcRequest("chan_unsubscribeAll", {});
            return this.send(rpc);
        };
    }
    static connect(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const cp = new IframeChannelProvider(opts);
            if (cp.exists()) {
                yield cp.close();
            }
            yield new Promise((res) => __awaiter(this, void 0, void 0, function* () {
                if (document.readyState === "loading") {
                    window.addEventListener("DOMContentLoaded", () => __awaiter(this, void 0, void 0, function* () {
                        yield cp.open();
                        res();
                    }));
                }
                else {
                    yield cp.open();
                    res();
                }
            }));
            return cp;
        });
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            this.subscribe();
            yield this.render();
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.unsubscribe();
            yield this.unrender();
            this.onDisconnect();
        });
    }
    send(rpc) {
        if (typeof this.iframe === "undefined") {
            throw new Error("iframe is not rendered!");
        }
        if (this.iframe.contentWindow === null) {
            throw new Error("iframe inner page not loaded!");
        }
        return new Promise((resolve, reject) => {
            this.events.once(`${rpc.id}`, (response) => {
                var _a;
                if ((_a = response === null || response === void 0 ? void 0 : response.error) === null || _a === void 0 ? void 0 : _a.message) {
                    return reject(vector_types_1.VectorError.fromJson(response.error));
                }
                else {
                    return resolve(response === null || response === void 0 ? void 0 : response.result);
                }
            });
            this.iframe.contentWindow.postMessage(JSON.stringify(rpc), "*");
        });
    }
    on(event, listener) {
        if (isEventName(event) || isMethodName(event)) {
            const rpc = vector_utils_1.constructRpcRequest("chan_subscribe", {
                event,
                once: false,
            });
            return this.send(rpc).then((id) => {
                this.events.on(id, listener);
            });
        }
        return this.events.on(event, listener);
    }
    once(event, listener) {
        if (isEventName(event) || isMethodName(event)) {
            const rpc = vector_utils_1.constructRpcRequest("chan_subscribe", {
                event,
                once: true,
            });
            return this.send(rpc).then((id) => {
                this.events.once(id, listener);
            });
        }
        return this.events.once(event, listener);
    }
    exists() {
        if (this.iframe) {
            return true;
        }
        if (window.document.getElementById(this.opts.id)) {
            return true;
        }
        return false;
    }
    render() {
        if (this.exists()) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.events.on("iframe-initialized", () => {
                this.onConnect();
                resolve();
            });
            this.iframe = renderElement("iframe", {
                id: this.opts.id,
                src: this.opts.src,
                style: "width:0;height:0;border:0;border:none;display:block",
            }, window.document.body);
        });
    }
    unrender() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const child = window.document.getElementById(this.opts.id);
            if (!child) {
                return Promise.resolve();
            }
            try {
                (_a = child.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(child);
            }
            finally {
                this.iframe = undefined;
            }
        });
    }
    handleIncomingMessages(e) {
        const iframeOrigin = new URL(this.opts.src).origin;
        if (e.origin === iframeOrigin) {
            if (typeof e.data !== "string") {
                throw new Error(`Invalid incoming message data:${e.data}`);
            }
            if (e.data.startsWith("event:")) {
                const event = e.data.replace("event:", "");
                this.events.emit(event);
            }
            else {
                const payload = vector_utils_1.safeJsonParse(e.data);
                if (payload.method === "chan_subscription") {
                    const { subscription, data } = payload.params;
                    this.events.emit(subscription, data);
                }
                else {
                    this.events.emit(`${payload.id}`, payload);
                }
            }
        }
    }
    subscribe() {
        if (this.subscribed) {
            return;
        }
        window.addEventListener("message", this.handleIncomingMessages.bind(this));
        this.subscribed = true;
    }
    unsubscribe() {
        if (!this.subscribed) {
            return;
        }
        this.subscribed = false;
        window.removeEventListener("message", this.handleIncomingMessages.bind(this));
    }
    onConnect() {
        this.connected = true;
        this.events.emit("connect");
        this.events.emit("open");
    }
    onDisconnect() {
        this.connected = false;
        this.events.emit("disconnect");
        this.events.emit("close");
    }
}
exports.IframeChannelProvider = IframeChannelProvider;
class DirectProvider {
    constructor(engine) {
        this.engine = engine;
        this.connected = false;
    }
    send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const rpc = vector_utils_1.constructRpcRequest(payload.method, payload.params);
            const res = yield this.engine.request(rpc);
            return res;
        });
    }
    open() {
        throw new Error("Method not implemented.");
    }
    close() {
        throw new Error("Method not implemented.");
    }
    on(event, callback, filter) {
        this.engine.on(event, callback, filter);
    }
    once(event, callback, filter) {
        this.engine.once(event, callback, filter);
    }
}
exports.DirectProvider = DirectProvider;
//# sourceMappingURL=channelProvider.js.map