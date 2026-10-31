// Single source of truth for the block-explorer (GembaScan) URL (audit finding L1).
// Previously this URL was hand-copied into ~6 files under two different names, so a
// change (e.g. Sepolia Etherscan → GembaScan) had to be made in every file. Import
// from here instead; override via VITE_ETHERSCAN_URL if ever needed.
export const EXPLORER_URL =
  (import.meta.env.VITE_ETHERSCAN_URL as string) || 'https://testnet.gembascan.io';

/** `<explorer>/address/<addr>` */
export const explorerAddress = (addr: string) => `${EXPLORER_URL}/address/${addr}`;
/** `<explorer>/tx/<hash>` */
export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
/** `<explorer>/token/<addr>?a=<tokenId>` (ERC-721 per-token view) */
export const explorerToken = (addr: string, tokenId: string | number) =>
  `${EXPLORER_URL}/token/${addr}?a=${tokenId}`;

/**
 * The IPFS gateway every off-chain link goes through. OURS, not a public one: the platform pins to
 * its own Kubo node and serves it at ipfs.gembait.com, so sending visitors to ipfs.io both broke
 * the gallery whenever that gateway was down (it was, from 2026-09-21) and told a third party which
 * CIDs each visitor was reading. Override with VITE_IPFS_GATEWAY if the host ever changes.
 */
export const IPFS_GATEWAY =
  ((import.meta.env.VITE_IPFS_GATEWAY as string) || 'https://ipfs.gembait.com/ipfs').replace(/\/+$/, '');

/** `ipfs://<cid>/<path>` -> a URL on our gateway. Anything else is returned untouched. */
export const ipfsUrl = (uri: string): string =>
  uri && uri.startsWith('ipfs://') ? `${IPFS_GATEWAY}/${uri.slice(7)}` : uri;
