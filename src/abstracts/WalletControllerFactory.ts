import { AbstractWalletController } from './AbstractWalletController';

export interface WalletControllerFactory {
	isWalletAvailable(): Promise<boolean>;
	create(options?: any): AbstractWalletController;
	blockchainGroup: string;
	wallet: string;
}
