import { AbstractBlockchainController, AbstractWalletController, Ylide } from '..';
import { BlockchainMap, BlockchainWalletMap } from '../types';

export class YlideControllers {
	readonly blockchains: AbstractBlockchainController[] = [];
	readonly blockchainsMap: BlockchainMap<AbstractBlockchainController> = {};
	readonly wallets: AbstractWalletController[] = [];
	readonly walletsMap: BlockchainWalletMap<AbstractWalletController> = {};

	async addBlockchain(blockchain: string, options?: any) {
		if (this.blockchainsMap[blockchain]) {
			throw new Error('You should have only one blockchain reader per blockchain per instance');
		}
		const ctrl = await Ylide.instantiateBlockchain(blockchain, options);
		this.blockchainsMap[blockchain] = ctrl;
		this.blockchains.push(ctrl);
		return ctrl;
	}

	async addWallet(blockchainGroup: string, wallet: string, options?: any) {
		if (this.walletsMap[blockchainGroup] && this.walletsMap[blockchainGroup][wallet]) {
			throw new Error('You should have only one wallet type per blockchain per instance');
		}
		const walletController = await Ylide.instantiateWallet(blockchainGroup, wallet, options);
		this.walletsMap[blockchainGroup] = {
			...(this.walletsMap[blockchainGroup] || {}),
			[wallet]: walletController,
		};
		this.wallets.push(walletController);
		return walletController;
	}
}
