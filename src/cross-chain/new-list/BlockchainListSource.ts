import { EventEmitter } from 'eventemitter3';
import { AbstractBlockchainController } from '../../abstracts';
import { IMessage, IMessageBase } from '../../types';
import asyncTimer from '../../utils/asyncTimer';
import { BlockchainSourceType, ISourceSubject } from '../BlockchainSource';
import { GenericListSource } from './ListSource';

/**
 * @internal
 */
export class BlockchainListSource extends EventEmitter implements GenericListSource {
	protected pullTimer: any;
	protected lastMessage: IMessage | null = null;

	constructor(
		public readonly reader: AbstractBlockchainController,
		public readonly subject: ISourceSubject,
		protected _pullCycle: number = 5000,
		public readonly limit = 50,
		public readonly meta: any = null,
	) {
		super();
	}

	pause() {
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	resume(since?: IMessageBase | undefined): void {
		this.lastMessage = since || null;
		if (!this.pullTimer) {
			this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
		}
	}

	compare(a: IMessage, b: IMessage): number {
		if (a.createdAt === b.createdAt) {
			return this.reader.compareMessagesTime(a, b);
		} else {
			return a.createdAt - b.createdAt;
		}
	}

	async getBefore(entry: IMessage, limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return await this.reader.retrieveMessageHistoryByBounds(
				this.subject.sender,
				this.subject.recipient,
				undefined,
				entry,
				limit,
			);
		} else {
			return await this.reader.retrieveBroadcastHistoryByBounds(this.subject.sender, undefined, entry, limit);
		}
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return await this.reader.retrieveMessageHistoryByBounds(
				this.subject.sender,
				this.subject.recipient,
				entry,
				undefined,
				limit,
			);
		} else {
			return await this.reader.retrieveBroadcastHistoryByBounds(this.subject.sender, entry, undefined, limit);
		}
	}

	async getLast(limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return await this.reader.retrieveMessageHistoryByBounds(
				this.subject.sender,
				this.subject.recipient,
				undefined,
				undefined,
				limit,
			);
		} else {
			return await this.reader.retrieveBroadcastHistoryByBounds(this.subject.sender, undefined, undefined, limit);
		}
	}

	protected async pull() {
		const messages = this.lastMessage
			? await this.getAfter(this.lastMessage, this.limit)
			: await this.getLast(this.limit);
		if (messages.length) {
			this.lastMessage = messages[0];
			this.emit('messages', { reader: this.reader, subject: this.subject, messages });
		}
	}
}
