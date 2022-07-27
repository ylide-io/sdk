import { AbstractBlockchainController } from './AbstractBlockchainController';

export interface BlockchainControllerFactory {
	blockchain: string;
	create(options?: any): AbstractBlockchainController;
}
