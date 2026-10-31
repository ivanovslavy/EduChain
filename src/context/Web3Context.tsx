import { createContext, useContext, useMemo, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Contract, Signer } from 'ethers';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useEthersSigner, useEthersProvider } from '../lib/ethersAdapter';
import { DEFAULT_CHAIN } from '../config/wagmi';
import { publicReadContracts } from '../lib/publicReader';

import addresses from '../contracts/addresses.json';
import WhitelistABI from '../contracts/abis/Whitelist.json';
import GameTokenABI from '../contracts/abis/GameToken.json';
import GameNFTPredefinedABI from '../contracts/abis/GameNFTPredefined.json';
import GameNFTCustomABI from '../contracts/abis/GameNFTCustom.json';
import TokenMarketplaceABI from '../contracts/abis/TokenMarketplace.json';
import TrackingContractABI from '../contracts/abis/TrackingContract.json';
import ETHFaucetABI from '../contracts/abis/ETHFaucet.json';
import CertificateRegistryABI from '../contracts/abis/CertificateRegistry.json';

interface Contracts {
  whitelist: Contract | null;
  gameToken: Contract | null;
  gameNFTPredefined: Contract | null;
  gameNFTCustom: Contract | null;
  marketplace: Contract | null;
  trackingContract: Contract | null;
  ethFaucet: Contract | null;
  certificateRegistry: Contract | null;
}

interface Web3ContextValue {
  account: string | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  correctChain: boolean;
  contracts: Contracts;
  // Raw ethers Signer when the wallet is connected and on the correct chain.
  // Use `withSigner(contracts.foo)` (or `.connect(signer)`) for write methods,
  // because `contracts.*` may be bound to the read-only provider during the
  // brief wagmi-walletClient hydration window — calling buyTokens / mint /
  // claim on a provider-bound contract throws ethers' UNSUPPORTED_OPERATION
  // ("contract runner does not support sending transactions").
  signer: Signer | null;
  withSigner: <T extends Contract | null>(contract: T) => T;
  isWhitelisted: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  refreshRoles: () => Promise<void>;
  addresses: typeof addresses;
}

const emptyContracts: Contracts = {
  whitelist: null, gameToken: null, gameNFTPredefined: null,
  gameNFTCustom: null, marketplace: null, trackingContract: null, ethFaucet: null,
  certificateRegistry: null,
};

const Web3Context = createContext<Web3ContextValue | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const signer = useEthersSigner();
  const provider = useEthersProvider();
  const { switchChain } = useSwitchChain();

  const correctChain = chainId === DEFAULT_CHAIN.id;

  // Auto-switch to GembaBlockchain on connect. If the wallet connects on any other
  // chain (MetaMask default is Ethereum Mainnet), fire the switchChain prompt
  // exactly once so the user can accept and land on GembaBlockchain without a manual
  // step. If they reject, the WrongNetwork pill in WalletButton stays visible
  // and they can switch manually from there. The ref prevents repeated prompts
  // on re-renders; it resets on disconnect so the next connect can retry.
  const autoSwitchTried = useRef(false);
  useEffect(() => {
    if (!isConnected) {
      autoSwitchTried.current = false;
      return;
    }
    if (!correctChain && !autoSwitchTried.current) {
      autoSwitchTried.current = true;
      switchChain({ chainId: DEFAULT_CHAIN.id });
    }
  }, [isConnected, correctChain, switchChain]);

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
        // 2026-10-31 — certificates. The address only exists after the registry is deployed, so
        // a tree without it must still work: `null` rather than a Contract on a bad address.
        certificateRegistry: addresses.certificateRegistry
          ? new Contract(addresses.certificateRegistry, (CertificateRegistryABI as any).abi, runner as any)
          : null,
      };
    } catch (e) {
      console.error('Contract init failed', e);
      return emptyContracts;
    }
  }, [signer, provider, correctChain]);

  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // `contracts.whitelist` gets a new Contract instance every time the
  // `contracts` memo recomputes, which happens 2-3 times during a wallet
  // connect sequence (signer swap, chainId settle, autoSwitch completion).
  // Without this counter, older in-flight role checks could resolve AFTER
  // newer ones and silently overwrite the correct state with stale `false`,
  // which manifested as member links flickering in/out at login.
  const roleCheckId = useRef(0);

  const refreshRoles = useCallback(async () => {
    const myId = ++roleCheckId.current;

    if (!address) {
      if (myId === roleCheckId.current) {
        setIsWhitelisted(false); setIsOwner(false); setIsAdmin(false);
      }
      return;
    }

    // Role reads go through `publicReadContracts.whitelist` (backed by
    // publicnode.com, NOT Infura) so they never share quota with wagmi /
    // MetaMask transactions. Previously reads went through `contracts.whitelist`
    // (= signer / Infura) and competed with parallel wagmi hydration calls on
    // refresh, silently rate-limiting → member links never rendered.
    const wlContract = publicReadContracts.whitelist;

    type R<T> = { ok: true; v: T } | { ok: false };
    const [wl, owner, admin] = await Promise.all([
      wlContract.checkWhitelist(address)
        .then((v: unknown) => ({ ok: true as const, v: !!v }))
        .catch((e: unknown) => { console.warn('[Web3] whitelist.checkWhitelist', e); return { ok: false as const }; }) as Promise<R<boolean>>,
      wlContract.owner()
        .then((v: unknown) => ({ ok: true as const, v: typeof v === 'string' ? v.toLowerCase() : '' }))
        .catch((e: unknown) => { console.warn('[Web3] whitelist.owner', e); return { ok: false as const }; }) as Promise<R<string>>,
      wlContract.isAdmin?.(address)
        .then((v: unknown) => ({ ok: true as const, v: !!v }))
        .catch((e: unknown) => { console.warn('[Web3] whitelist.isAdmin', e); return { ok: false as const }; }) as Promise<R<boolean>>
        ?? Promise.resolve({ ok: false as const } as R<boolean>),
    ]);

    // Last-started-wins: discard if a newer refresh has started.
    if (myId !== roleCheckId.current) return;

    if (wl.ok) setIsWhitelisted(wl.v);
    if (owner.ok) setIsOwner(owner.v === address.toLowerCase());
    if (admin.ok) setIsAdmin(admin.v);
  }, [address]);

  useEffect(() => { refreshRoles(); }, [refreshRoles]);

  // Helper to ensure a contract has a signer-runner before a write call.
  // If `signer` is missing we throw the sentinel `WALLET_NOT_READY` — useTxToast
  // catches it and shows a clean localised message. Returning the original
  // (provider-bound) contract here used to surface ethers' cryptic
  // UNSUPPORTED_OPERATION ("contract runner does not support sending
  // transactions") at the point of method invocation. Most common cause: a
  // page refresh where wagmi's `useAccount().isConnected` flipped on from
  // sessionStorage before `useWalletClient()` had hydrated — so contracts got
  // the read-only provider as their runner.
  const withSigner = useCallback(<T extends Contract | null>(contract: T): T => {
    if (!contract) return contract;
    if (!signer) throw new Error('WALLET_NOT_READY');
    return contract.connect(signer) as T;
  }, [signer]);

  const value: Web3ContextValue = {
    account: address, chainId, isConnected, correctChain,
    contracts, signer: signer ?? null, withSigner,
    isWhitelisted, isOwner, isAdmin, refreshRoles, addresses,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider');
  return ctx;
}
