import { AbstractBlockchainController } from './AbstractBlockchainController';
import { AbstractWalletController } from './AbstractWalletController';

export interface WalletControllerFactory {
	isWalletAvailable(): Promise<boolean>;
	create(blockchainController: AbstractBlockchainController, options?: any): AbstractWalletController;
	blockchain: string;
	wallet: string;
}
