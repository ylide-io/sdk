import { EventEmitter } from 'eventemitter3';
import { AbstractBlockchainController } from '../src/abstracts';
import { IMessage, Uint256 } from '../src/types';
import { asyncTimer } from '../src/utils/asyncTimer';
import { BlockchainSourceType, ISourceSubject } from '../src/messages-list/new-list';
import { GenericEntryPure, GenericSortedSource } from '../src/messages-list/types';

/**
 * @internal
 */
export class BlockchainSource extends EventEmitter implements GenericSortedSource<IMessage> {
	protected pullTimer: (() => void) | null = null;
	protected lastMessage: IMessage | null = null;
	protected inited = false;
	protected reallyInited = false;

	constructor(
		public readonly reader: AbstractBlockchainController,
		public readonly subject: ISourceSubject,
		protected _pullCycle: number = 5000,
		public readonly limit = 50,
		public readonly meta: any = null,
	) {
		super();
	}

	destroy() {
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	compare(a: GenericEntryPure<IMessage>, b: GenericEntryPure<IMessage>): number {
		if (a.time === a.time) {
			// we pass it in reverse order to ensure descending way
			return this.reader.compareMessagesTime(b.link, a.link);
		} else {
			return b.time - a.time;
		}
	}

	async getBefore(entry: GenericEntryPure<IMessage>, limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return (
				await this.reader.retrieveMessageHistoryDesc(
					this.subject.sender,
					this.subject.recipient,
					undefined,
					entry.link,
					limit,
				)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		} else {
			return (
				await this.reader.retrieveBroadcastHistoryDesc(this.subject.sender, undefined, entry.link, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		}
	}

	async getAfter(entry: GenericEntryPure<IMessage>, limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return (
				await this.reader.retrieveMessageHistoryDesc(
					this.subject.sender,
					this.subject.recipient,
					entry.link,
					undefined,
					limit,
				)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		} else {
			return (
				await this.reader.retrieveBroadcastHistoryDesc(this.subject.sender, entry.link, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
		}
	}

	async getLast(limit: number): Promise<GenericEntryPure<IMessage>[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			const res = (
				await this.reader.retrieveMessageHistoryDesc(
					this.subject.sender,
					this.subject.recipient,
					undefined,
					undefined,
					limit,
				)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
			this.lastMessage = res.length ? res[0].link : null;
			this.reallyInited = true;
			return res;
		} else {
			const res = (
				await this.reader.retrieveBroadcastHistoryDesc(this.subject.sender, undefined, undefined, limit)
			).map(msg => ({
				link: msg,
				time: msg.createdAt,
			}));
			this.lastMessage = res.length ? res[0].link : null;
			this.reallyInited = true;
			return res;
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
		if (this.pullTimer) {
			this.pullTimer();
		}
		this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
	}

	protected async pull() {
		if (!this.reallyInited) {
			return;
		}
		const messages = this.lastMessage
			? await this.getAfter({ link: this.lastMessage, time: this.lastMessage.createdAt }, this.limit)
			: await this.getLast(this.limit);
		if (messages.length) {
			this.lastMessage = messages[0].link;
			this.emit('messages', { reader: this.reader, subject: this.subject, messages });
			for (const message of messages) {
				this.emit('message', { reader: this.reader, subject: this.subject, message });
			}
		}
	}
}
