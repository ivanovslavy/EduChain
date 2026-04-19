import { http, createConfig } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const SUPPORTED_CHAINS = [sepolia, mainnet] as const;
export const DEFAULT_CHAIN = sepolia;

const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || '';
const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || '';

const connectors: any[] = [injected({ shimDisconnect: true })];
if (WC_PROJECT_ID) {
  connectors.push(
    walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: 'EduChain',
        description: 'On-chain NFT + token platform by GEMBA IT',
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
    [sepolia.id]: http(RPC_URL || undefined),
    [mainnet.id]: http(),
  },
});
