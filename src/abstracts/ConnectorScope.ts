import type { BlockchainControllerFactory } from './BlockchainControllerFactory';
import type { WalletControllerFactory } from './WalletControllerFactory';

export interface ConnectorScope {
	walletFactories: WalletControllerFactory[];
	blockchainFactories: BlockchainControllerFactory[];
}
