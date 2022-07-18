import {
	AbstractReadingController,
	AbstractReadingControllerClass,
	AbstractReadingControllerConstructor,
} from './abstracts/AbstractReadingController';
import {
	AbstractSendingController,
	AbstractSendingControllerConstructor,
	AbstractSendingControllerClass,
} from './abstracts/AbstractSendingController';

export * from './types';
export * from './abstracts';
export * from './storage';
export * from './keystore';
export * from './crypto';
export * from './content';
// export * from './fetch';

export type WalletMap<T> = Record<string, T>;
export type BlockchainMap<T> = Record<string, T>;
export type BlockchainWalletMap<T> = BlockchainMap<WalletMap<T>>;

/**
 * @description It's a singleton entry point to all interactions with Ylide SDK
 * @example
 * ```ts
 * import { Ylide } from '@ylide/sdk';
 * import { EverscaleReadingController, EverscaleSendingController } from '@ylide/everscale';
 *
 * Ylide.registerReader(EverscaleReadingController);
 * Ylide.registerSender(EverscaleSendingController);
 *
 * const sendingCls = Ylide.getSender('everscale', 'everwallet');
 * const readingCls = Ylide.getReader('everscale');
 * const wallet = await Ylide.instantiateWallet(sendingCls, readingCls, { dev: false });
 *
 * const isMyAddressValid = wallet.reader.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
 * ```
 */
export class Ylide {
	private static _senders: BlockchainWalletMap<AbstractSendingControllerClass> = {};
	private static _readers: BlockchainMap<AbstractReadingControllerClass> = {};

	/**
	 * Use this method to register all available blockchain senders to Ylide.
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { EverscaleSendingController } from '@ylide/everscale';
	 *
	 * Ylide.registerSender(EverscaleSendingController);
	 * ```
	 * @param cls Sending controller which you want to register
	 */
	static registerSender(cls: AbstractSendingControllerClass) {
		this._senders[cls.blockchainType()] = {
			...this._senders[cls.blockchainType()],
			[cls.walletType()]: cls,
		};
	}

	/**
	 * Use this method to register all available blockchain readers to Ylide.
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { EverscaleReadingController } from '@ylide/everscale';
	 *
	 * Ylide.registerReader(EverscaleReadingController);
	 * ```
	 * @param cls Reading controller which you want to register
	 */
	static registerReader(cls: AbstractReadingControllerClass) {
		this._readers[cls.blockchainType()] = cls;
		this.registerSender;
	}

	/**
	 * Method to check availability of a certain blockchain for reading messages
	 * @example
	 * ```ts
	 * Ylide.isReaderRegistered('everscale'); // return true if `Ylide.registerReader` was called with this blockchain reader before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isReaderRegistered(blockchain: string) {
		return !!this._readers[blockchain];
	}

	/**
	 * Method to check availability of a certain blockchain for sending messages
	 * @example
	 * ```ts
	 * Ylide.isSenderRegistered('everscale'); // return true if `Ylide.registerSender` was called with this blockchain sender before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isSenderRegistered(blockchain: string, wallet: string) {
		return !!(this._senders[blockchain] && this._senders[blockchain][wallet]);
	}

	/**
	 * Method to get reading controller class for a certain blockchain
	 * @example
	 * ```ts
	 * const cls = Ylide.getReader('everscale');
	 * const everscaleReader = await Ylide.instantiateReader(cls);
	 * // ...
	 * const isMyAddressValid = everscaleReader.isAddressValid('some address');
	 * ```
	 * @param blockchain Name of blockchain
	 */
	static getReader(blockchain: string) {
		return this._readers[blockchain];
	}

	/**
	 * Method to get sending controller class for a certain blockchain
	 * @example
	 * ```ts
	 * const cls = Ylide.getSender('everscale', 'everwallet');
	 * const everscaleSender = await Ylide.instantiateSender(cls);
	 * // ...
	 * const myAccount = await everscaleSender.getAuthenticatedAccount();
	 * ```
	 * @param blockchain Name of blockchain
	 * @param wallet Name of in-browser wallet
	 */
	static getSender(blockchain: string, wallet: string) {
		return this._senders[blockchain][wallet];
	}

	/**
	 * Method to get registered sending controllers
	 * @example
	 * ```ts
	 * const ethereumWalletSenders = Ylide.sendersList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get sendersList() {
		return Object.keys(this._senders)
			.map(blockchain =>
				Object.keys(this._senders[blockchain]).map(wallet => ({
					blockchain,
					wallet,
					cls: this._senders[blockchain][wallet],
				})),
			)
			.flat();
	}

	/**
	 * Method to get registered reading controllers
	 * @example
	 * ```ts
	 * const ethereumWalletReaders = Ylide.readersList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get readersList() {
		return Object.keys(this._readers).map(blockchain => ({
			blockchain,
			cls: this._readers[blockchain],
		}));
	}

	/**
	 * Method to get a list of registered sending controllers that are available in the user's browser (wallets installed)
	 * @example
	 * ```ts
	 * const availableSenders = await Ylide.getAvailableSenders();
	 * ```
	 */
	static async getAvailableSenders(): Promise<AbstractSendingControllerClass[]> {
		const list = this.sendersList;

		const result: AbstractSendingControllerClass[] = [];

		for (const sender of list) {
			try {
				if (await sender.cls.isWalletAvailable()) {
					result.push(sender.cls);
				}
			} catch (e) {
				//
			}
		}

		return result;
	}

	/**
	 * Method to get a list of registered reading controllers
	 * @example
	 * ```ts
	 * const availableReaders = await Ylide.getAvailableReaders();
	 * ```
	 */
	static async getAvailableReaders(): Promise<AbstractReadingControllerClass[]> {
		return this.readersList.map(r => r.cls);
	}

	/**
	 * Method to instantiate both sending and reading controllers with the same options
	 * @example
	 * ```ts
	 * const sendingCls = Ylide.getSender('everscale', 'everwallet');
	 * const readingCls = Ylide.getReader('everscale');
	 * const wallet = await Ylide.instantiateWallet(sendingCls, readingCls, { dev: false });
	 *
	 * const isMyAddressValid = wallet.reader.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static async instantiateWallet(
		senderCls: AbstractSendingControllerClass,
		readerCls: AbstractReadingControllerClass,
		options?: any,
	) {
		const sender = await this.instantiateSender(senderCls, options);
		const reader = this.instantiateReader(readerCls, options);
		return { sender, reader };
	}

	/**
	 * Method to instantiate sending controller with double-check of wallet availability
	 * @example
	 * ```ts
	 * const sendingCls = Ylide.getSender('everscale', 'everwallet');
	 * const sender = await Ylide.instantiateSender(sendingCls, { dev: false });
	 *
	 * const myAccount = await sender.getAuthenticatedAccount();
	 * ```
	 */
	static async instantiateSender(
		provider: AbstractSendingControllerClass,
		options?: any,
	): Promise<AbstractSendingController> {
		if (!(await provider.isWalletAvailable())) {
			throw new Error('Wallet is not available');
		}
		return new (provider as unknown as AbstractSendingControllerConstructor)(options);
	}

	/**
	 * Method to instantiate reading controller
	 * @example
	 * ```ts
	 * const readingCls = Ylide.getReader('everscale');
	 * const reader = await Ylide.instantiateReader(readingCls, { dev: false });
	 *
	 * const isMyAddressValid = reader.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static instantiateReader(provider: AbstractReadingControllerClass, options?: any): AbstractReadingController {
		return new (provider as unknown as AbstractReadingControllerConstructor)(options);
	}
}
