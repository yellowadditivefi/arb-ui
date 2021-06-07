"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonEIP712Message = exports.EIP712Value = exports.EIP712Types = exports.EIP712Domain = void 0;
const constants_1 = require("@ethersproject/constants");
exports.EIP712Domain = {
    name: "Vector",
    version: "1",
    salt: constants_1.HashZero,
};
exports.EIP712Types = {
    Greeting: [
        {
            name: "contents",
            type: "string",
        },
    ],
};
exports.EIP712Value = {
    contents: "Welcome to Connext. Please confirm signature to sign in!",
};
exports.NonEIP712Message = "Connext Login v1.0";
//# sourceMappingURL=constants.js.map