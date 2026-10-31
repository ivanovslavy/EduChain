/**
 * Dedicated read-only GembaBlockchain contracts for public homepage stats.
 *
 * Intentionally SEPARATE from the `useWeb3()` contracts in `Web3Context`.
 * Those contracts depend on the user's wallet connection / chain state,
 * and race conditions between read-only fallback and signer swap caused
 * member-role flicker on login. This module sidesteps all of that by
 * using a fresh ethers `JsonRpcProvider` pointed directly at a public
 * GembaBlockchain endpoint — always available, never tied to MetaMask.
 *
 * Stats are also **cached at module level** via `loadPublicStats()` so
 * that even if the Home component unmounts and remounts (which happens
 * on wagmi chain/connect state changes and can otherwise flash stats
 * back to `...` briefly), the cached snapshot is returned instantly.
 *
 * Do not import this from pages that perform transactions — use the
 * signer-backed contracts from `useWeb3()` for writes.
 */
import { JsonRpcProvider, Contract, Network } from 'ethers';
import addresses from '../contracts/addresses.json';
import TrackingContractABI from '../contracts/abis/TrackingContract.json';
import GameNFTPredefinedABI from '../contracts/abis/GameNFTPredefined.json';
import GameNFTCustomABI from '../contracts/abis/GameNFTCustom.json';
import GameTokenABI from '../contracts/abis/GameToken.json';
import WhitelistABI from '../contracts/abis/Whitelist.json';
import TokenMarketplaceABI from '../contracts/abis/TokenMarketplace.json';

// Hardcoded public endpoint — intentionally does NOT read `VITE_RPC_URL`
// from env because that value is an Infura key shared with wagmi / MetaMask
// for transactions. Concurrent loads (MetaMask JSON-RPC + page stats + hot
// reload during dev) were hitting the Infura free-tier rate limits and the
// homepage stats silently stopped resolving. This module-scoped provider
// stays on a public, unauthenticated endpoint so public stats never share
// quota with user transactions.
const RPC_URL = 'https://rpc1.gembascan.io';

// Static GembaBlockchain network — skip runtime eth_chainId detection on first call,
// which otherwise adds latency and an extra RPC round-trip.
const SEPOLIA = new Network('gemba', 821207);

/**
 * Module-scoped GembaBlockchain JsonRpcProvider backed by publicnode.com.
 * Exported so callers like `Faucet.tsx` can run `.getBalance(address)`
 * without going through the Infura-backed wagmi publicClient (which
 * gets rate-limited by parallel MetaMask traffic).
 */
export const publicReadProvider = new JsonRpcProvider(RPC_URL, SEPOLIA, { staticNetwork: SEPOLIA });
const provider = publicReadProvider;

export const publicReadContracts = {
  trackingContract: new Contract(addresses.trackingContract, (TrackingContractABI as any).abi, provider),
  gameNFTPredefined: new Contract(addresses.gameNFTPredefined, (GameNFTPredefinedABI as any).abi, provider),
  gameNFTCustom: new Contract(addresses.gameNFTCustom, (GameNFTCustomABI as any).abi, provider),
  gameToken: new Contract(addresses.gameToken, (GameTokenABI as any).abi, provider),
  // Whitelist read-only contract for role lookup in `Web3Context.refreshRoles`.
  // Reading via publicnode (not Infura) keeps role checks off the wagmi/MetaMask
  // RPC quota — the Infura free-tier limit was being hit by parallel MetaMask
  // hydration + whitelist reads on refresh, silently returning false/error and
  // hiding the member links.
  whitelist: new Contract(addresses.whitelist, (WhitelistABI as any).abi, provider),
  // Marketplace read-only contract for Marketplace.tsx. The browse + mine +
  // stats reads were sharing Infura quota with wagmi/MetaMask hydration and
  // getSellerListingIds sometimes silently returned empty — "My listings"
  // showed 0 even when the user had just created a listing. Routing reads
  // through publicnode removes the quota contention entirely; writes still
  // go through the signer-backed `contracts.marketplace` in Web3Context.
  marketplace: new Contract(addresses.marketplace, (TokenMarketplaceABI as any).abi, provider),
};

export interface PublicStats {
  totalUsers: number | null;
  nftsMinted: number | null;
  gameTokensCirculating: number | null;
}

let cachedStats: PublicStats | null = null;
let inFlight: Promise<PublicStats> | null = null;

/**
 * Load the four homepage stats once per page lifetime. Subsequent calls
 * return the cached snapshot synchronously (wrapped in a resolved promise)
 * — keeps stats stable across component remounts triggered by wallet state.
 */
export function loadPublicStats(): Promise<PublicStats> {
  if (cachedStats) return Promise.resolve(cachedStats);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const logErr = (label: string) => (e: unknown) => {
      console.warn(`[publicStats] ${label} failed`, e);
      return null;
    };

    const [eco, preSales, customSupply, gameSales] = await Promise.all([
      publicReadContracts.trackingContract.getEcosystemStats().catch(logErr('getEcosystemStats')),
      publicReadContracts.gameNFTPredefined.getSalesStats().catch(logErr('predefined.getSalesStats')),
      publicReadContracts.gameNFTCustom.totalSupply().catch(logErr('custom.totalSupply')),
      publicReadContracts.gameToken.getSalesStats().catch(logErr('gameToken.getSalesStats')),
    ]);

    const predefinedMinted = preSales ? Number((preSales as any).totalMinted ?? (preSales as any)[1] ?? 0) : 0;
    const customMinted = customSupply !== null ? Number(customSupply) : 0;

    // GAME "in circulation" = totalTokensSold (actually purchased by users
    // via buyTokens), NOT totalSupply (which is the pre-minted 1 000 000
    // INITIAL_SUPPLY sitting on the owner / contract wallet).
    // GameToken.getSalesStats() returns (totalSalesETH, totalTokensSold,
    // totalTransactions, tokenPrice); index 1 is totalTokensSold in whole
    // tokens (not wei), so no decimal formatting needed.
    const circulating = gameSales ? Number((gameSales as any).totalTokensSold ?? (gameSales as any)[1] ?? 0) : null;

    const snapshot: PublicStats = {
      totalUsers: eco ? Number((eco as any).totalTrackedUsers ?? (eco as any)[0] ?? 0) : null,
      nftsMinted: preSales || customSupply !== null ? predefinedMinted + customMinted : null,
      gameTokensCirculating: circulating,
    };

    cachedStats = snapshot;
    inFlight = null;
    return snapshot;
  })();

  return inFlight;
}

/** Force a fresh fetch (e.g. after a transaction). Rarely needed — the page
 *  is a static snapshot at page-load time. */
export function invalidatePublicStats(): void {
  cachedStats = null;
  inFlight = null;
}
