import { AbstractWalletController } from './AbstractWalletController';

export interface WalletControllerFactory {
	isWalletAvailable(): Promise<boolean>;
	create(options?: any): Promise<AbstractWalletController>;
	blockchainGroup: string;
	wallet: string;
}
