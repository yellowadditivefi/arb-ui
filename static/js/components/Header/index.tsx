import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BridgeBalance,
  ERC721Balance,
  ContractStorage,
  BridgeToken
} from 'token-bridge-sdk'
import { useIsDepositMode } from 'components/App/ModeContext'
import ExplorerLink from 'components/App/ExplorerLink'
import { useNetwork, useL2Network } from 'components/App/NetworkContext'
import { requestNetworkSwitch } from 'util/web3'

interface Web3Data {
  ethAddress: string
  ethBalance: BridgeBalance | undefined
  erc20Balance: BridgeBalance | undefined
  erc721Balance: ERC721Balance | undefined
  bridgeTokens: ContractStorage<BridgeToken>
  currentERC20Address: string
  currentERC721Address: string
}

const Header = ({
  ethAddress,
  ethBalance,
  erc20Balance,
  erc721Balance,
  bridgeTokens,
  currentERC20Address,
  currentERC721Address
}: Web3Data) => {
  const currentERC20 = bridgeTokens[currentERC20Address]
  const erc20Symbol = currentERC20 ? currentERC20.symbol : ''

  const currentERC721 = bridgeTokens[currentERC721Address]
  const erc721Symbol = currentERC721 ? currentERC721.symbol : ''
  const isDepositMode = useIsDepositMode()

  const onClick = (e: any) => {
    e.preventDefault()
    window.open(window.location.origin + '#info')
  }
  const { name, isArbitrum } = useNetwork()
  const l2Network = useL2Network()

  const headerDisplay = useMemo(() => {
    return `Connected to ${name}`
  }, [name])

  return (
    <div className="col-lg-12">
      <div className="top-thing">
        {' '}
        <a href="https://arbitrum.io/" target="_blank">
          ARBITRUM
        </a>{' '}
      </div>

      <h1 className="text-center">Arbitrum Token Bridge</h1>
      <h5 className="text-center">{headerDisplay}</h5>

      {!isArbitrum ? (
        <h5
          onClick={() => requestNetworkSwitch(l2Network)}
          className="text-center switch-notice"
        >
          Add/Switch to Arbitrum Network
        </h5>
      ) : (
        <h5 className="text-center">
          <a
            onClick={onClick}
            href=""
            style={{ fontSize: 12, fontFamily: 'Montserrat Light' }}
          >
            (Connect to {isDepositMode ? 'L2' : 'L1'})
          </a>{' '}
        </h5>
      )}

      <div className="address-container">
        <p className="address">
          Your address:{' '}
          <span id="accountAddress">
            <ExplorerLink hash={ethAddress} type={'address'} />
          </span>
        </p>
        <p className="arbchain">
          {/* Address of ArbChain:{' '} */}
          {/* <span id="rollupAddress">
          <ExplorerLink hash={vmId} type={'chain'} />
        </span> */}
        </p>
        {/* {ethBalance && (
        <p>
          Total ETH On Arb Chain:{' '}
          <span>{formatEther(ethBalance.totalArbBalance)}</span>
        </p>
      )}
      {erc20Balance && (
        <p>
          Total {erc20Symbol} On Arb Chain:{' '}
          <span>{formatEther(erc20Balance.totalArbBalance)}</span>
        </p>
      )}
      {erc721Balance && (
        <p>
          Total # of {erc721Symbol} NFTs On Arb Chain:{' '}
          <span>{erc721Balance.totalArbTokens.length}</span>
        </p>
      )} */}
      </div>
      <hr />
    </div>
  )
}

export default Header
