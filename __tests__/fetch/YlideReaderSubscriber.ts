import { EventEmitter } from 'eventemitter3';
import { Ylide, BlockchainMap } from '..';
import {
	AbstractBlockchainController,
	AbstractBlockchainControllerClass,
} from '../abstracts/AbstractBlockchainController';
import { RetrievingMessagesOptions } from '../types/IMessage';
import asyncTimer from '../utils/asyncTimer';

/**
 * @internal
 */
export class Ylideblockchainsubscriber extends EventEmitter {
	private pullTimer: any;
	private lastPullDate: Date | null = null;

	private readonly activeblockchains: BlockchainMap<AbstractBlockchainController> = {};
	private readonly activeAddresses: BlockchainMap<string[]> = {};

	connectReaderByClass(address: string, readerCls: AbstractBlockchainControllerClass) {
		const blockchain = readerCls.blockchainType();
		if (this.activeAddresses[blockchain].includes(address)) {
			return;
		}
		const reader = this.activeblockchains[blockchain] || Ylide.instantiateBlockchain(readerCls);
		this.activeblockchains[blockchain] = reader;
		this.activeAddresses[blockchain].push(address);
	}

	connectReaderByBlockchain(address: string, blockchain: string) {
		if (this.activeAddresses[blockchain].includes(address)) {
			return;
		}
		if (!this.activeblockchains[blockchain] && !Ylide.isBlockchainRegistered(blockchain)) {
			throw new Error(`Reader for blockchain ${blockchain} is not available`);
		}
		const reader =
			this.activeblockchains[blockchain] ||
			Ylide.instantiateBlockchain(Ylide.getBlockchainController(blockchain));
		this.activeblockchains[blockchain] = reader;
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
		for (const readerBlockchain of Object.keys(this.activeblockchains)) {
			const addresses = this.activeAddresses[readerBlockchain];
			const reader = this.activeblockchains[readerBlockchain];

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
