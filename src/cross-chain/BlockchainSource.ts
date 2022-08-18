import { EventEmitter } from 'eventemitter3';
import { AbstractBlockchainController } from '../abstracts';
import { IMessage, Uint256 } from '../types';
import asyncTimer from '../utils/asyncTimer';
import { GenericEntryPure, GenericSortedSource } from './types/GenericSortedMergedList';

export enum BlockchainSourceSubjectType {
	RECIPIENT,
	AUTHOR,
}

export interface ISourceSubject {
	type: BlockchainSourceSubjectType;
	address: Uint256 | null;
}

/**
 * @internal
 */
export class BlockchainSource extends EventEmitter implements GenericSortedSource<IMessage> {
	private pullTimer: any;
	private lastMessage: IMessage | null = null;
	private inited = false;

	constructor(
		public readonly reader: AbstractBlockchainController,
		public readonly subject: ISourceSubject,
		private _pullCycle: number = 5000,
		public readonly limit = 50,
	) {
		super();
	}

	destroy() {
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	cmpr(a: GenericEntryPure<IMessage>, b: GenericEntryPure<IMessage>): number {
		if (a.time === a.time) {
			// we pass it in reverse order to ensure descending way
			return this.reader.compareMessagesTime(b.link, a.link);
		} else {
			return b.time - a.time;
		}
	}

	async getBefore(entry: GenericEntryPure<IMessage>, limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceSubjectType.RECIPIENT) {
			return (
				await this.reader.retrieveMessageHistoryByBounds(this.subject.address, undefined, entry.link, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		} else {
			return (
				await this.reader.retrieveBroadcastHistoryByBounds(this.subject.address, undefined, entry.link, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		}
	}

	async getAfter(entry: GenericEntryPure<IMessage>, limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceSubjectType.RECIPIENT) {
			return (
				await this.reader.retrieveMessageHistoryByBounds(this.subject.address, entry.link, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		} else {
			return (
				await this.reader.retrieveBroadcastHistoryByBounds(this.subject.address, entry.link, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		}
	}

	async getLast(limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceSubjectType.RECIPIENT) {
			return (
				await this.reader.retrieveMessageHistoryByBounds(this.subject.address, undefined, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		} else {
			return (
				await this.reader.retrieveBroadcastHistoryByBounds(this.subject.address, undefined, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		}
	}

	get pullCycle() {
		return this._pullCycle;
	}

	set pullCycle(val: number) {
		this._pullCycle = val;
		if (this.pullTimer) {
			this.pullTimer();
		}
		this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
	}

	async init() {
		if (this.inited) {
			return;
		}
		this.inited = true;
		await this.pull();
		if (this.pullTimer) {
			this.pullTimer();
		}
		this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
	}

	private async pull() {
		const messages = this.lastMessage
			? await this.getAfter({ link: this.lastMessage, time: this.lastMessage.createdAt }, this.limit)
			: await this.getLast(this.limit);
		if (messages.length) {
			this.lastMessage = messages[0].link;
			console.log(`${this.reader.constructor.name} for ${this.subject.address}: `, messages);
			this.emit('messages', { reader: this.reader, subject: this.subject, messages });
			for (const message of messages) {
				this.emit('message', { reader: this.reader, subject: this.subject, message });
			}
		}
	}
}
