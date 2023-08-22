import { YlideMisusageError } from '../errors/YlideMisusageError';
import { YlideError, YlideErrorType } from '../errors';

import type { AbstractBlockchainController } from '../abstracts/AbstractBlockchainController';
import type { AbstractWalletController } from '../abstracts/AbstractWalletController';
import type { Ylide } from '../Ylide';
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

	async addWallet(wallet: string, options?: any, blockchainGroup?: string) {
		const refs = this.ylide.walletsList.filter(
			w => w.wallet === wallet && (!blockchainGroup || w.blockchainGroup === blockchainGroup),
		);
		if (refs.length > 1) {
			throw new YlideMisusageError(
				'YlideControllers',
				'You should provide blockchainGroup as a last param if you have two wallets with the same name',
			);
		}
		if (refs.length === 0) {
			throw new YlideError(
				YlideErrorType.NOT_FOUND,
				`Wallet ${wallet} is not found in the list of available wallets`,
			);
		}
		const ref = refs[0];
		if (this.walletsMap[ref.blockchainGroup] && this.walletsMap[ref.blockchainGroup][wallet]) {
			throw new YlideMisusageError(
				'YlideControllers',
				'You should have only one wallet type per blockchain per instance',
			);
		}
		const walletController = await this.ylide.instantiateWallet(ref.blockchainGroup, wallet, options);
		this.walletsMap[ref.blockchainGroup] = {
			...(this.walletsMap[ref.blockchainGroup] || {}),
			[wallet]: walletController,
		};
		this.wallets.push(walletController);
		return walletController;
	}
}
