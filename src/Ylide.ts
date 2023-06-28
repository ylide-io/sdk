import { WalletControllerFactory, BlockchainControllerFactory } from './abstracts';
import { YlideControllers, YlideCore } from './core';
import { YlideKeyStore } from './keystore';
import { BlockchainWalletMap, BlockchainMap } from './types';

/**
 * @description It's a singleton entry point to all interactions with Ylide SDK
 * @example
 * ```ts
 * import { Ylide } from '@ylide/sdk';
 * import { everscaleBlockchainFactory, everscaleWalletFactory } from '@ylide/everscale';
 *
 * Ylide.registerBlockchain(everscaleBlockchainFactory);
 * Ylide.registerWallet(everscaleWalletFactory);
 *
 * const wallet = await Ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
 *
 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
 * ```
 */
export class Ylide {
	private static _isVerbose = false;
	private static _walletFactories: BlockchainWalletMap<WalletControllerFactory> = {};
	private static _blockchainFactories: BlockchainMap<BlockchainControllerFactory> = {};
	private static _blockchainToGroupMap: Record<string, string> = {};

	static get blockchainToGroupMap() {
		return this._blockchainToGroupMap;
	}

	/**
	 * @description This method is used to make SDK verbose. It means that all extra logs will be printed to console.
	 */
	static verbose() {
		this._isVerbose = true;
	}

	/**
	 * @description This method is used to make SDK silent. It means that all extra logs will be hidden.
	 */
	static silent() {
		this._isVerbose = false;
	}

	/**
	 * @description This method is used to check if SDK is verbose.
	 */
	static get isVerbose() {
		return this._isVerbose;
	}

	private static verboseLog(...args: any[]) {
		if (this._isVerbose) {
			console.log('[Y-SDK]', ...args);
		}
	}

	private static verboseLogTick(...args: any[]) {
		if (this._isVerbose) {
			console.log('[Y-SDK]', ...args);
			const timer = setTimeout(() => {
				console.log('[Y-SDK]', '...still working...', ...args);
			}, 5000);
			return () => clearTimeout(timer);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			return () => {};
		}
	}

	/**
	 * Use this method to register all available blockchain wallets to Ylide.
	 *
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { everscaleWalletFactory } from '@ylide/everscale';
	 *
	 * Ylide.registerWallet(everscaleWalletFactory);
	 * ```
	 * @param factory Wallet controller factory which you want to register
	 */
	static registerWalletFactory(factory: WalletControllerFactory) {
		this._walletFactories[factory.blockchainGroup] = {
			...this._walletFactories[factory.blockchainGroup],
			[factory.wallet]: factory,
		};
	}

	/**
	 * Use this method to register all available blockchain blockchains to Ylide.
	 *
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { everscaleBlockchainFactory } from '@ylide/everscale';
	 *
	 * Ylide.registerBlockchain(everscaleBlockchainFactory);
	 * ```
	 * @param factory Blockchain controller factory which you want to register
	 */
	static registerBlockchainFactory(factory: BlockchainControllerFactory) {
		this._blockchainFactories[factory.blockchain] = factory;
		this._blockchainToGroupMap[factory.blockchain] = factory.blockchainGroup;
	}

	/**
	 * Method to check availability of a certain blockchain for reading messages
	 *
	 * @example
	 * ```ts
	 * Ylide.isBlockchainRegistered('everscale'); // return true if `Ylide.registerBlockchain` was called with this blockchain controller factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isBlockchainRegistered(blockchain: string) {
		return !!this._blockchainFactories[blockchain];
	}

	/**
	 * Method to check availability of a certain blockchain for sending messages
	 *
	 * @example
	 * ```ts
	 * Ylide.isWalletRegistered('everscale', 'everwallet'); // return true if `Ylide.registerWallet` was called with this wallet factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isWalletRegistered(blockchain: string, wallet: string) {
		return !!(this._walletFactories[blockchain] && this._walletFactories[blockchain][wallet]);
	}

	/**
	 * Method to get blockchain controller factory for a certain blockchain
	 *
	 * @param blockchain Name of blockchain
	 */
	static getBlockchainControllerFactory(blockchain: string) {
		return this._blockchainFactories[blockchain];
	}

	/**
	 * Method to get wallet controller factory for a certain blockchain and wallet type
	 *
	 * @param blockchainGroup Name of the blockchain group
	 * @param wallet Name of in-browser wallet
	 */
	static getWalletControllerFactory(blockchainGroup: string, wallet: string) {
		if (!this._walletFactories[blockchainGroup]) {
			throw new Error(`Blockchain group ${blockchainGroup} not found`);
		}
		if (!this._walletFactories[blockchainGroup][wallet]) {
			throw new Error(`Wallet ${wallet} not found in the blockchain group ${blockchainGroup}`);
		}
		return this._walletFactories[blockchainGroup][wallet];
	}

	/**
	 * Method to get registered wallet controllers
	 *
	 * @example
	 * ```ts
	 * const ethereumWallets = Ylide.walletsList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get walletsList() {
		return Object.keys(this._walletFactories)
			.map(blockchain =>
				Object.keys(this._walletFactories[blockchain]).map(wallet => ({
					blockchain,
					wallet,
					factory: this._walletFactories[blockchain][wallet],
				})),
			)
			.flat();
	}

	/**
	 * Method to get registered blockchain controllers
	 *
	 * @example
	 * ```ts
	 * const ethereumChains = Ylide.blockchainsList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get blockchainsList() {
		return Object.keys(this._blockchainFactories).map(blockchain => ({
			blockchain,
			factory: this._blockchainFactories[blockchain],
		}));
	}

	/**
	 * Method to get a list of registered wallet controllers that are available in the user's browser (wallets installed)
	 *
	 * @example
	 * ```ts
	 * const availableWallets = await Ylide.getAvailableWallets();
	 * ```
	 */
	static async getAvailableWallets(): Promise<WalletControllerFactory[]> {
		const list = this.walletsList;

		const result: WalletControllerFactory[] = [];

		for (const sender of list) {
			try {
				const done = this.verboseLogTick(`Checking availability of ${sender.blockchain} ${sender.wallet}`);
				const isAvailable = await sender.factory.isWalletAvailable();
				done();
				if (isAvailable) {
					result.push(sender.factory);
				}
			} catch (e) {
				//
			}
		}

		return result;
	}

	/**
	 * Method to get a list of registered blockchain controllers
	 *
	 * @example
	 * ```ts
	 * const availableBlockchains = await Ylide.getAvailableBlockchains();
	 * ```
	 */
	static async getAvailableBlockchains(): Promise<BlockchainControllerFactory[]> {
		return this.blockchainsList.map(r => r.factory);
	}

	/**
	 * Method to instantiate both wallet and blockchain controllers with the same options
	 *
	 * @example
	 * ```ts
	 * const wallet = await Ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
	 *
	 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static async instantiateWallet(blockchainGroup: string, wallet: string, options?: any) {
		const walletControllerFactory = this.getWalletControllerFactory(blockchainGroup, wallet);
		const doneAvailabilityCheck = this.verboseLogTick(`Checking availability of ${blockchainGroup} ${wallet}`);
		const isAvailable = await walletControllerFactory.isWalletAvailable();
		doneAvailabilityCheck();
		if (!isAvailable) {
			throw new Error('Wallet is not available');
		}
		const doneWalletControllerCreate = this.verboseLogTick(
			`Creating ${blockchainGroup} ${wallet} wallet controller`,
		);
		const walletController = await walletControllerFactory.create(
			Object.assign({ verbose: this._isVerbose }, options || {}),
		);
		doneWalletControllerCreate();
		const doneWalletControllerInit = this.verboseLogTick(
			`Initializing ${blockchainGroup} ${wallet} wallet controller`,
		);
		await walletController.init();
		doneWalletControllerInit();
		return walletController;
	}

	/**
	 * Method to instantiate blockchain controller
	 *
	 * @example
	 * ```ts
	 * const blockchainController = await Ylide.instantiateBlockchain('everscale', { dev: false });
	 *
	 * const isMyAddressValid = blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static async instantiateBlockchain(blockchain: string, options?: any) {
		const blockchainControllerFactory = this.getBlockchainControllerFactory(blockchain);
		const doneBlockchainControllerCreate = this.verboseLogTick(`Creating ${blockchain} blockchain controller`);
		const blockchainController = await blockchainControllerFactory.create(
			Object.assign({ verbose: this._isVerbose }, options || {}),
		);
		doneBlockchainControllerCreate();
		const doneBlockchainControllerInit = this.verboseLogTick(`Initializing ${blockchain} blockchain controller`);
		await blockchainController.init();
		doneBlockchainControllerInit();
		return blockchainController;
	}

	// non-singleton part starts here:

	controllers: YlideControllers;
	core: YlideCore;

	constructor(keystore: YlideKeyStore, indexerBlockchains: string[] = []) {
		this.controllers = new YlideControllers();
		this.core = new YlideCore(this.controllers, keystore, indexerBlockchains);
	}
}
