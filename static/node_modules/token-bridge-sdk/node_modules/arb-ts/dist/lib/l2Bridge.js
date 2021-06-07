/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.L2Bridge = exports.ARB_SYS_ADDRESS = void 0;
const ethers_1 = require("ethers");
const ArbTokenBridge__factory_1 = require("./abi/factories/ArbTokenBridge__factory");
const ArbSys__factory_1 = require("./abi/factories/ArbSys__factory");
const ICustomToken__factory_1 = require("./abi/factories/ICustomToken__factory");
const StandardArbERC20__factory_1 = require("./abi/factories/StandardArbERC20__factory");
const ArbRetryableTx__factory_1 = require("./abi/factories/ArbRetryableTx__factory");
exports.ARB_SYS_ADDRESS = '0x0000000000000000000000000000000000000064';
const ARB_RETRYABLE_TX_ADDRESS = '0x000000000000000000000000000000000000006E';
/**
 * L2 side only of {@link Bridge}
 */
class L2Bridge {
    constructor(arbTokenBridgeAddress, l2Signer) {
        this.l2Tokens = {};
        this.l2Signer = l2Signer;
        const l2Provider = l2Signer.provider;
        if (l2Provider === undefined) {
            throw new Error('Signer must be connected to an (Arbitrum) provider');
        }
        this.l2Provider = l2Provider;
        this.arbSys = ArbSys__factory_1.ArbSys__factory.connect(exports.ARB_SYS_ADDRESS, l2Signer);
        this.arbTokenBridge = ArbTokenBridge__factory_1.ArbTokenBridge__factory.connect(arbTokenBridgeAddress, l2Signer);
        this.arbRetryableTx = ArbRetryableTx__factory_1.ArbRetryableTx__factory.connect(ARB_RETRYABLE_TX_ADDRESS, l2Signer);
        this.l2EthBalance = ethers_1.BigNumber.from(0);
    }
    /**
     * Initiate Ether withdrawal (via ArbSys)
     */
    async withdrawETH(value, destinationAddress, overrides) {
        const address = destinationAddress || (await this.getWalletAddress());
        return this.arbSys.functions.withdrawEth(address, Object.assign({ value }, overrides));
    }
    getLatestBlock() {
        return this.l2Provider.getBlock('latest');
    }
    /**
     * Initiate token withdrawal (via ArbTokenBridge)
     */
    async withdrawERC20(erc20l1Address, amount, destinationAddress, overrides = {}) {
        const destination = destinationAddress || (await this.getWalletAddress());
        const tokenData = await this.getAndUpdateL2TokenData(erc20l1Address);
        if (!tokenData) {
            throw new Error("Can't withdraw; token not deployed");
        }
        const erc20TokenData = tokenData.ERC20;
        if (!erc20TokenData) {
            throw new Error(`Can't withdraw; ArbERC20 for ${erc20l1Address} doesn't exist`);
        }
        return erc20TokenData.contract.functions.withdraw(destination, amount, overrides);
    }
    async updateAllL2Tokens() {
        for (const l1Address in this.l2Tokens) {
            await this.getAndUpdateL2TokenData(l1Address);
        }
        return this.l2Tokens;
    }
    async getAndUpdateL2TokenData(erc20L1Address) {
        const tokenData = this.l2Tokens[erc20L1Address] || {
            ERC20: undefined,
            ERC777: undefined,
            CUSTOM: undefined,
        };
        this.l2Tokens[erc20L1Address] = tokenData;
        const walletAddress = await this.getWalletAddress();
        // handle custom L2 token:
        const [customTokenAddress,] = await this.arbTokenBridge.functions.customL2Token(erc20L1Address);
        if (customTokenAddress !== ethers_1.ethers.constants.AddressZero) {
            const customTokenContract = ICustomToken__factory_1.ICustomToken__factory.connect(customTokenAddress, this.l2Signer);
            tokenData.CUSTOM = {
                contract: customTokenContract,
                balance: ethers_1.BigNumber.from(0),
            };
            try {
                const [balance] = await customTokenContract.functions.balanceOf(walletAddress);
                tokenData.CUSTOM.balance = balance;
            }
            catch (err) {
                console.warn("Could not get custom token's balance", err);
            }
        }
        const l2ERC20Address = await this.getERC20L2Address(erc20L1Address);
        // check if standard arb erc20:
        if (!tokenData.ERC20) {
            if ((await this.l2Provider.getCode(l2ERC20Address)).length > 2) {
                const arbERC20TokenContract = await StandardArbERC20__factory_1.StandardArbERC20__factory.connect(l2ERC20Address, this.l2Signer);
                const [balance] = await arbERC20TokenContract.functions.balanceOf(walletAddress);
                tokenData.ERC20 = {
                    contract: arbERC20TokenContract,
                    balance,
                };
            }
            else {
                console.info(`Corresponding ArbERC20 for ${erc20L1Address} not yet deployed (would be at ${l2ERC20Address})`);
            }
        }
        else {
            const arbERC20TokenContract = await StandardArbERC20__factory_1.StandardArbERC20__factory.connect(l2ERC20Address, this.l2Signer);
            const [balance] = await arbERC20TokenContract.functions.balanceOf(walletAddress);
            tokenData.ERC20.balance = balance;
        }
        if (tokenData.ERC20 || tokenData.CUSTOM) {
            return tokenData;
        }
        else {
            console.warn(`No L2 token for ${erc20L1Address} found`);
            return;
        }
    }
    getERC20L2Address(erc20L1Address) {
        var _a, _b;
        let address;
        if ((address = (_b = (_a = this.l2Tokens[erc20L1Address]) === null || _a === void 0 ? void 0 : _a.ERC20) === null || _b === void 0 ? void 0 : _b.contract.address)) {
            return address;
        }
        return this.arbTokenBridge.functions
            .calculateL2TokenAddress(erc20L1Address)
            .then(([res]) => res);
    }
    getERC20L1Address(erc20L2Address) {
        try {
            const arbERC20 = StandardArbERC20__factory_1.StandardArbERC20__factory.connect(erc20L2Address, this.l2Signer);
            return arbERC20.functions.l1Address().then(([res]) => res);
        }
        catch (e) {
            console.warn('Could not get L1 Address');
            return undefined;
        }
    }
    getTxnSubmissionPrice(dataSize) {
        return this.arbRetryableTx.functions.getSubmissionPrice(dataSize);
    }
    async getWalletAddress() {
        if (this.walletAddressCache) {
            return this.walletAddressCache;
        }
        this.walletAddressCache = await this.l2Signer.getAddress();
        return this.walletAddressCache;
    }
    async getAndUpdateL2EthBalance() {
        const bal = await this.l2Signer.getBalance();
        this.l2EthBalance = bal;
        return bal;
    }
}
exports.L2Bridge = L2Bridge;
