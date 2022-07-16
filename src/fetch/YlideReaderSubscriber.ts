import { EventEmitter } from 'eventemitter3';
import Ylide, { BlockchainMap } from '..';
import { AbstractReadingController, AbstractReadingControllerClass } from '../abstracts/AbstractReadingController';
import { RetrievingMessagesOptions } from '../types/IMessage';
import asyncTimer from '../utils/asyncTimer';

export class YlideReaderSubscriber extends EventEmitter {
	private pullTimer: any;
	private lastPullDate: Date | null = null;

	private readonly activeReaders: BlockchainMap<AbstractReadingController> = {};
	private readonly activeAddresses: BlockchainMap<string[]> = {};

	connectReaderByClass(address: string, readerCls: AbstractReadingControllerClass) {
		const blockchain = readerCls.blockchainType();
		if (this.activeAddresses[blockchain].includes(address)) {
			return;
		}
		const reader = this.activeReaders[blockchain] || Ylide.instantiateReader(readerCls);
		this.activeReaders[blockchain] = reader;
		this.activeAddresses[blockchain].push(address);
	}

	connectReaderByBlockchain(address: string, blockchain: string) {
		if (this.activeAddresses[blockchain].includes(address)) {
			return;
		}
		if (!this.activeReaders[blockchain] && !Ylide.isReaderRegistered(blockchain)) {
			throw new Error(`Reader for blockchain ${blockchain} is not available`);
		}
		const reader = this.activeReaders[blockchain] || Ylide.instantiateReader(Ylide.getReader(blockchain));
		this.activeReaders[blockchain] = reader;
		this.activeAddresses[blockchain].push(address);
	}

	disconnectReader(address: string, blockchain: string) {
		const idx = this.activeAddresses[blockchain].indexOf(address);
		if (idx === -1) {
			throw new Error('This address is not reading');
		}
		this.activeAddresses[blockchain].splice(idx, 1);
	}

	constructor(private _pullCycle: number = 5000) {
		super();

		this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
	}

	get pullCycle() {
		return this._pullCycle;
	}

	set pullCycle(val: number) {
		this._pullCycle = val;
		this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
	}

	private async optionalLoad(options?: RetrievingMessagesOptions) {
		for (const readerBlockchain of Object.keys(this.activeReaders)) {
			const addresses = this.activeAddresses[readerBlockchain];
			const reader = this.activeReaders[readerBlockchain];

			for (const address of addresses) {
				const messages = await reader.retrieveMessageHistoryByDates(address, options);
				if (messages.length) {
					this.emit('messages', { blockchain: readerBlockchain, address, messages });
					for (const message of messages) {
						this.emit('message', { blockchain: readerBlockchain, address, message });
					}
				}
			}
		}
	}

	private async pull() {
		if (!this.lastPullDate) {
			return;
		}
		const oldPullDate = this.lastPullDate;
		this.lastPullDate = new Date();
		await this.optionalLoad({ since: oldPullDate });
	}

	async descendingLoad() {
		this.lastPullDate = new Date();
		await this.optionalLoad({ to: this.lastPullDate });
	}
}
