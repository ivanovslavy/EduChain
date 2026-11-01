import { createContext, useContext, useMemo, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Contract, Signer } from 'ethers';
import { useAccount, useSwitchChain } from 'wagmi';
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
  /**
   * True only when the wallet really is on another network: the chain has been read back, it is
   * not ours, and the one-shot auto-switch has already settled. Use this for anything the user
   * SEES; use `correctChain` for anything that LOCKS, because a lock may not wait for a latch.
   */
  wrongNetwork: boolean;
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
  // The network check reads `useAccount().chain`, NOT `useChainId()`.
  //
  // `useChainId()` returns `config.state.chainId`, and createConfig refuses to record a chain that
  // is not in its own `chains` list (@wagmi/core createConfig.js, syncConnectedChain:
  // `if (!isChainConfigured) return`, plus validatePersistedChainId). SUPPORTED_CHAINS has exactly
  // one member, so `useChainId()` was pinned to 821207 and could never disagree with
  // DEFAULT_CHAIN.id — `correctChain` was a constant `true` and every gate below it was dead code.
  // What the user actually hit instead was `getConnectorClient` throwing ConnectorChainMismatchError
  // against the connector's real chain id, i.e. a connected wallet with a green dot and every
  // write failing as WALLET_NOT_READY.
  //
  // `chain` is resolved from the connector's REAL chain id (@wagmi/core getConnection.js:
  // `config.chains.find((chain) => chain.id === connection?.chainId)`), so `chain === undefined`
  // means exactly "the wallet is on a network this app does not support". `chainId` is kept as the
  // raw wallet chain id — unlike `chain`, it is still populated on a foreign network, so the
  // banner can name the chain the user is actually on.
  const { address, isConnected, status, chain, chainId } = useAccount();
  const signer = useEthersSigner();
  const provider = useEthersProvider();
  const { switchChain, isPending: switchPending } = useSwitchChain();

  const correctChain = chain?.id === DEFAULT_CHAIN.id;

  // `chain === undefined` only says something about the WALLET once wagmi reports 'connected'.
  // During 'connecting'/'reconnecting' it just means the chain id has not been read back yet — and
  // `isConnected` is already true while reconnecting (getConnection.js: `isConnected: !!address`),
  // so `isConnected` on its own cannot tell "still resolving" from "unsupported network".
  const chainResolved = status === 'connected';

  // Auto-switch to GembaBlockchain on connect. If the wallet connects on any other
  // chain (MetaMask default is Ethereum Mainnet), fire the switchChain prompt
  // exactly once so the user can accept and land on GembaBlockchain without a manual
  // step. If they reject, the WrongNetwork pill in WalletButton stays visible
  // and they can switch manually from there. The ref prevents repeated prompts
  // on re-renders; it resets on disconnect so the next connect can retry.
  const autoSwitchTried = useRef(false);
  const [autoSwitchSettled, setAutoSwitchSettled] = useState(false);
  useEffect(() => {
    if (!chainResolved) {
      autoSwitchTried.current = false;
      setAutoSwitchSettled(false);
      return;
    }
    if (correctChain) {
      setAutoSwitchSettled(true);
      return;
    }
    if (!autoSwitchTried.current) {
      autoSwitchTried.current = true;
      // onSettled fires on accept AND on reject, so a rejected prompt still unlatches the banner.
      switchChain({ chainId: DEFAULT_CHAIN.id }, { onSettled: () => setAutoSwitchSettled(true) });
    }
  }, [chainResolved, correctChain, switchChain]);

  // The only thing allowed to claim "wrong network" on screen. All four conditions matter:
  // the chain has actually been read back, it is not ours, the one-shot auto-switch has finished
  // (accepted or rejected), and no switch is in flight. Without the last two a wallet that is
  // about to be switched flashes a warning during the handshake, which is noise, not information.
  const wrongNetwork = chainResolved && !correctChain && autoSwitchSettled && !switchPending;

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
    // A signature must never be requested on a foreign chain. `contracts` is already emptied when
    // `correctChain` is false, but this is the lock that matters: it is on the one path every
    // write goes through, so a contract instance that outlived a network switch cannot be used.
    if (!correctChain) throw new Error('WRONG_NETWORK');
    if (!signer) throw new Error('WALLET_NOT_READY');
    return contract.connect(signer) as T;
  }, [signer, correctChain]);

  const value: Web3ContextValue = {
    account: address, chainId, isConnected, correctChain, wrongNetwork,
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
