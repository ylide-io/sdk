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
export * from './fetch';

export type WalletMap<T> = Record<string, T>;
export type BlockchainMap<T> = Record<string, T>;
export type BlockchainWalletMap<T> = BlockchainMap<WalletMap<T>>;

export default class Ylide {
	private static _senders: BlockchainWalletMap<AbstractSendingControllerClass> = {};
	private static _readers: BlockchainMap<AbstractReadingControllerClass> = {};

	static registerSender(cls: AbstractSendingControllerClass) {
		this._senders[cls.blockchainType()] = {
			...this._senders[cls.blockchainType()],
			[cls.walletType()]: cls,
		};
	}

	static registerReader(cls: AbstractReadingControllerClass) {
		this._readers[cls.blockchainType()] = cls;
	}

	static isReaderRegistered(blockchain: string) {
		return !!this._readers[blockchain];
	}

	static isSenderRegistered(blockchain: string, wallet: string) {
		return !!(this._senders[blockchain] && this._senders[blockchain][wallet]);
	}

	static getReader(blockchain: string) {
		return this._readers[blockchain];
	}

	static getSender(blockchain: string, wallet: string) {
		return this._senders[blockchain][wallet];
	}

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

	static get readersList() {
		return Object.keys(this._readers).map(blockchain => ({
			blockchain,
			cls: this._readers[blockchain],
		}));
	}

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

	static async getAvailableReaders(): Promise<AbstractReadingControllerClass[]> {
		return this.readersList.map(r => r.cls);
	}

	static async instantiateWallet(
		senderCls: AbstractSendingControllerClass,
		readerCls: AbstractReadingControllerClass,
		options?: any,
	) {
		const sender = await this.instantiateSender(senderCls, options);
		const reader = this.instantiateReader(readerCls, options);
		return { sender, reader };
	}

	static async instantiateSender(
		provider: AbstractSendingControllerClass,
		options?: any,
	): Promise<AbstractSendingController> {
		if (!(await provider.isWalletAvailable())) {
			throw new Error('Wallet is not available');
		}
		return new (provider as unknown as AbstractSendingControllerConstructor)(options);
	}

	static instantiateReader(provider: AbstractReadingControllerClass, options?: any): AbstractReadingController {
		return new (provider as unknown as AbstractReadingControllerConstructor)(options);
	}
}
