import addressesJson from './addresses.json';

export interface EcosystemAddresses {
  whitelist: string;
  gameToken: string;
  gameNFTPredefined: string;
  gameNFTCustom: string;
  marketplace: string;
  trackingContract: string;
  ethFaucet: string;
}

export const addresses = addressesJson as EcosystemAddresses;
