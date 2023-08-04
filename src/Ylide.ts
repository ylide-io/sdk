import { YlideControllers } from './core/YlideControllers';
import { YlideCore } from './core/YlideCore';
import { YlideError, YlideErrorType } from './errors';

import type { WalletControllerFactory, BlockchainControllerFactory } from './abstracts';
import type { YlideKeyRegistry } from './keystore';
import type { BlockchainWalletMap, BlockchainMap } from './primitives';

/**
 * @description It's a singleton entry point to all interactions with Ylide SDK
 * @example
 * ```ts
 * import { Ylide } from '@ylide/sdk';
 * import { everscaleBlockchainFactory, everscaleWalletFactory } from '@ylide/everscale';
 *
 * const ylide = new Ylide();
 *
 * ylide.registerBlockchain(everscaleBlockchainFactory);
 * ylide.registerWallet(everscaleWalletFactory);
 *
 * const wallet = await ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
 *
 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
 * ```
 */
export class Ylide {
	private _isVerbose = false;
	private _walletFactories: BlockchainWalletMap<WalletControllerFactory> = {};
	private _blockchainFactories: BlockchainMap<BlockchainControllerFactory> = {};
	private _blockchainToGroupMap: Record<string, string> = {};

	public readonly controllers: YlideControllers;
	public readonly core: YlideCore;

	constructor(public readonly keyRegistry: YlideKeyRegistry, indexerBlockchains: string[] = []) {
		this.controllers = new YlideControllers(this);
		this.core = new YlideCore(this, this.controllers, keyRegistry, indexerBlockchains);
	}

	get blockchainToGroupMap() {
		return this._blockchainToGroupMap;
	}

	/**
	 * @description This method is used to make SDK verbose. It means that all extra logs will be printed to console.
	 */
	verbose() {
		this._isVerbose = true;
	}

	/**
	 * @description This method is used to make SDK silent. It means that all extra logs will be hidden.
	 */
	silent() {
		this._isVerbose = false;
	}

	/**
	 * @description This method is used to check if SDK is verbose.
	 */
	get isVerbose() {
		return this._isVerbose;
	}

	private verboseLog(...args: any[]) {
		if (this._isVerbose) {
			console.log('[Y-SDK]', ...args);
		}
	}

	private verboseLogTick(...args: any[]) {
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
	 * const ylide = new Ylide();
	 *
	 * ylide.registerWallet(everscaleWalletFactory);
	 * ```
	 * @param factory Wallet controller factory which you want to register
	 */
	registerWalletFactory(factory: WalletControllerFactory) {
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
	 * const ylide = new Ylide();
	 *
	 * ylide.registerBlockchain(everscaleBlockchainFactory);
	 * ```
	 * @param factory Blockchain controller factory which you want to register
	 */
	registerBlockchainFactory(factory: BlockchainControllerFactory) {
		this._blockchainFactories[factory.blockchain] = factory;
		this._blockchainToGroupMap[factory.blockchain] = factory.blockchainGroup;
	}

	/**
	 * Method to check availability of a certain blockchain for reading messages
	 *
	 * @example
	 * ```ts
	 * ylide.isBlockchainRegistered('everscale'); // return true if `Ylide.registerBlockchain` was called with this blockchain controller factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	isBlockchainRegistered(blockchain: string) {
		return !!this._blockchainFactories[blockchain];
	}

	/**
	 * Method to check availability of a certain blockchain for sending messages
	 *
	 * @example
	 * ```ts
	 * ylide.isWalletRegistered('everscale', 'everwallet'); // return true if `Ylide.registerWallet` was called with this wallet factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	isWalletRegistered(blockchain: string, wallet: string) {
		return !!(this._walletFactories[blockchain] && this._walletFactories[blockchain][wallet]);
	}

	/**
	 * Method to get blockchain controller factory for a certain blockchain
	 *
	 * @param blockchain Name of blockchain
	 */
	getBlockchainControllerFactory(blockchain: string) {
		return this._blockchainFactories[blockchain];
	}

	/**
	 * Method to get wallet controller factory for a certain blockchain and wallet type
	 *
	 * @param blockchainGroup Name of the blockchain group
	 * @param wallet Name of in-browser wallet
	 */
	getWalletControllerFactory(blockchainGroup: string, wallet: string) {
		if (!this._walletFactories[blockchainGroup]) {
			throw new YlideError(YlideErrorType.NOT_FOUND, `Blockchain group ${blockchainGroup} not found`);
		}
		if (!this._walletFactories[blockchainGroup][wallet]) {
			throw new YlideError(
				YlideErrorType.NOT_FOUND,
				`Wallet ${wallet} not found in the blockchain group ${blockchainGroup}`,
			);
		}
		return this._walletFactories[blockchainGroup][wallet];
	}

	/**
	 * Method to get registered wallet controllers
	 *
	 * @example
	 * ```ts
	 * const evmWallets = ylide.walletsList.filter(t => t.blockchainGroup === 'evm');
	 * ```
	 */
	get walletsList() {
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
	 * const ethereumChains = ylide.blockchainsList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	get blockchainsList() {
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
	 * const availableWallets = await ylide.getAvailableWallets();
	 * ```
	 */
	async getAvailableWallets(): Promise<WalletControllerFactory[]> {
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
	 * const availableBlockchains = await ylide.getAvailableBlockchains();
	 * ```
	 */
	async getAvailableBlockchains(): Promise<BlockchainControllerFactory[]> {
		return this.blockchainsList.map(r => r.factory);
	}

	/**
	 * Method to instantiate both wallet and blockchain controllers with the same options
	 *
	 * @example
	 * ```ts
	 * const wallet = await ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
	 *
	 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	async instantiateWallet(blockchainGroup: string, wallet: string, options?: any) {
		const walletControllerFactory = this.getWalletControllerFactory(blockchainGroup, wallet);
		const doneAvailabilityCheck = this.verboseLogTick(`Checking availability of ${blockchainGroup} ${wallet}`);
		const isAvailable = await walletControllerFactory.isWalletAvailable();
		doneAvailabilityCheck();
		if (!isAvailable) {
			throw new YlideError(YlideErrorType.UNAVAILABLE, 'Wallet is not available');
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
	 * const blockchainController = await ylide.instantiateBlockchain('everscale', { dev: false });
	 *
	 * const isMyAddressValid = blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	async instantiateBlockchain(blockchain: string, options?: any) {
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
}
