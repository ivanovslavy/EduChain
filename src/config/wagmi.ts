import { createConfig } from 'wagmi';
import { defineChain, http, fallback } from 'viem';
import { injected, walletConnect } from 'wagmi/connectors';

// RPC fallback: if the primary endpoint is down/rate-limited, viem rotates to the
// next (rpc1 = .83 primary, rpc2 = .84, rpc3 fallback (archive testnet.gembascan.io/rpc is overloaded — not used)). Override via
// VITE_RPC_URLS (comma-separated).
const RPC_URLS = (
  (import.meta.env.VITE_RPC_URLS as string) ||
  (import.meta.env.VITE_RPC_URL as string) ||
  'https://rpc1.gembascan.io,https://rpc2.gembascan.io,https://rpc3.gembascan.io'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// GembaBlockchain testnet (gemba-testnet-1) — the chain EduChain now runs on.
// A custom EVM chain; defining rpcUrls + blockExplorers here lets wagmi prompt
// MetaMask to add/switch to it automatically (wallet_addEthereumChain).
export const gembaTestnet = defineChain({
  id: 821207,
  name: 'GembaBlockchain Testnet',
  nativeCurrency: { name: 'Gemba', symbol: 'GMB', decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: { default: { name: 'GembaScan', url: 'https://testnet.gembascan.io' } },
  testnet: true,
});

export const SUPPORTED_CHAINS = [gembaTestnet] as const;
export const DEFAULT_CHAIN = gembaTestnet;

const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || '';

const connectors: any[] = [injected({ shimDisconnect: true })];
if (WC_PROJECT_ID) {
  connectors.push(
    walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: 'EduChain',
        description: 'On-chain NFT + token learning platform on GembaBlockchain, by GEMBA IT',
        url: 'https://educhain.gembait.com',
        icons: ['https://educhain.gembait.com/favicon.svg'],
      },
      showQrModal: true,
    })
  );
}

export const config = createConfig({
  chains: SUPPORTED_CHAINS as any,
  connectors,
  transports: {
    // RPC fallback across all endpoints.
    [gembaTestnet.id]: fallback(RPC_URLS.map((u) => http(u))),
  },
});
