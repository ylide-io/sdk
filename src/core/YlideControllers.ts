import { YlideMisusageError } from '../errors/YlideMisusageError';

import type { Ylide } from '../Ylide';
import type { AbstractBlockchainController, AbstractWalletController } from '..';
import type { BlockchainMap, BlockchainWalletMap } from '../primitives';

export class YlideControllers {
	readonly blockchains: AbstractBlockchainController[] = [];
	readonly blockchainsMap: BlockchainMap<AbstractBlockchainController> = {};
	readonly wallets: AbstractWalletController[] = [];
	readonly walletsMap: BlockchainWalletMap<AbstractWalletController> = {};

	constructor(public readonly ylide: Ylide) {
		//
	}

	async addBlockchain(blockchain: string, options?: any) {
		if (this.blockchainsMap[blockchain]) {
			throw new YlideMisusageError(
				'YlideControllers',
				'You should have only one blockchain reader per blockchain per instance',
			);
		}
		const ctrl = await this.ylide.instantiateBlockchain(blockchain, options);
		this.blockchainsMap[blockchain] = ctrl;
		this.blockchains.push(ctrl);
		return ctrl;
	}

	async addWallet(blockchainGroup: string, wallet: string, options?: any) {
		if (this.walletsMap[blockchainGroup] && this.walletsMap[blockchainGroup][wallet]) {
			throw new YlideMisusageError(
				'YlideControllers',
				'You should have only one wallet type per blockchain per instance',
			);
		}
		const walletController = await this.ylide.instantiateWallet(blockchainGroup, wallet, options);
		this.walletsMap[blockchainGroup] = {
			...(this.walletsMap[blockchainGroup] || {}),
			[wallet]: walletController,
		};
		this.wallets.push(walletController);
		return walletController;
	}
}
