import { createContext, useContext, useMemo, useEffect, useState, useCallback, ReactNode } from 'react';
import { Contract } from 'ethers';
import { useAccount, useChainId } from 'wagmi';
import { useEthersSigner, useEthersProvider } from '../lib/ethersAdapter';
import { DEFAULT_CHAIN } from '../config/wagmi';

import addresses from '../contracts/addresses.json';
import WhitelistABI from '../contracts/abis/Whitelist.json';
import GameTokenABI from '../contracts/abis/GameToken.json';
import GameNFTPredefinedABI from '../contracts/abis/GameNFTPredefined.json';
import GameNFTCustomABI from '../contracts/abis/GameNFTCustom.json';
import TokenMarketplaceABI from '../contracts/abis/TokenMarketplace.json';
import TrackingContractABI from '../contracts/abis/TrackingContract.json';
import ETHFaucetABI from '../contracts/abis/ETHFaucet.json';

interface Contracts {
  whitelist: Contract | null;
  gameToken: Contract | null;
  gameNFTPredefined: Contract | null;
  gameNFTCustom: Contract | null;
  marketplace: Contract | null;
  trackingContract: Contract | null;
  ethFaucet: Contract | null;
}

interface Web3ContextValue {
  account: string | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  correctChain: boolean;
  contracts: Contracts;
  isWhitelisted: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  refreshRoles: () => Promise<void>;
  addresses: typeof addresses;
}

const emptyContracts: Contracts = {
  whitelist: null, gameToken: null, gameNFTPredefined: null,
  gameNFTCustom: null, marketplace: null, trackingContract: null, ethFaucet: null,
};

const Web3Context = createContext<Web3ContextValue | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const signer = useEthersSigner();
  const provider = useEthersProvider();

  const correctChain = chainId === DEFAULT_CHAIN.id;

  const contracts = useMemo<Contracts>(() => {
    if (!correctChain) return emptyContracts;
    const runner = signer || provider;
    if (!runner) return emptyContracts;
    try {
      return {
        whitelist:         new Contract(addresses.whitelist, (WhitelistABI as any).abi, runner as any),
        gameToken:         new Contract(addresses.gameToken, (GameTokenABI as any).abi, runner as any),
        gameNFTPredefined: new Contract(addresses.gameNFTPredefined, (GameNFTPredefinedABI as any).abi, runner as any),
        gameNFTCustom:     new Contract(addresses.gameNFTCustom, (GameNFTCustomABI as any).abi, runner as any),
        marketplace:       new Contract(addresses.marketplace, (TokenMarketplaceABI as any).abi, runner as any),
        trackingContract:  new Contract(addresses.trackingContract, (TrackingContractABI as any).abi, runner as any),
        ethFaucet:         new Contract(addresses.ethFaucet, (ETHFaucetABI as any).abi, runner as any),
      };
    } catch (e) {
      console.error('Contract init failed', e);
      return emptyContracts;
    }
  }, [signer, provider, correctChain]);

  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshRoles = useCallback(async () => {
    if (!address || !contracts.whitelist) {
      setIsWhitelisted(false); setIsOwner(false); setIsAdmin(false);
      return;
    }
    try {
      const wl = await contracts.whitelist.checkWhitelist(address).catch(() => false);
      const owner = await contracts.whitelist.owner().catch(() => '');
      const admin = await contracts.whitelist.isAdmin?.(address).catch(() => false) ?? false;
      setIsWhitelisted(!!wl);
      setIsOwner(typeof owner === 'string' && owner.toLowerCase() === address.toLowerCase());
      setIsAdmin(!!admin);
    } catch (e) {
      console.warn('Role check failed', e);
    }
  }, [address, contracts.whitelist]);

  useEffect(() => { refreshRoles(); }, [refreshRoles]);

  const value: Web3ContextValue = {
    account: address, chainId, isConnected, correctChain,
    contracts, isWhitelisted, isOwner, isAdmin, refreshRoles, addresses,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider');
  return ctx;
}
