import type { AbstractBlockchainController } from './AbstractBlockchainController';

export interface BlockchainControllerFactory {
	blockchain: string;
	blockchainGroup: string;
	create(options?: any): Promise<AbstractBlockchainController>;
}
