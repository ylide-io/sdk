import { EventEmitter } from 'eventemitter3';
import { IndexerHub } from '.';
import { IMessage, Uint256 } from '../types';
import { asyncTimer } from '../utils';
import { BlockchainSourceType, IBlockchainSourceSubject } from '../messages-list/types';
import { LowLevelMessagesSource } from '../messages-list/types/LowLevelMessagesSource';

/**
 * @internal
 */
export class IndexerMessagesSource extends EventEmitter implements LowLevelMessagesSource {
	protected pullTimer: (() => void) | null = null;
	protected lastMessage: IMessage | null = null;

	constructor(
		public readonly originalSource: LowLevelMessagesSource,
		public readonly indexerHub: IndexerHub,
		private compareMessagesTime: (a: IMessage, b: IMessage) => number,
		public readonly subject: IBlockchainSourceSubject,
		protected _pullCycle: number = 7000,
		public readonly limit = 50,
	) {
		super();
	}

	getName(): string {
		return `IndexerSource over ${this.originalSource.getName()}`;
	}

	pause() {
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	resume(since?: IMessage | undefined): void {
		this.lastMessage = since || null;
		if (!this.pullTimer) {
			this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
		}
	}

	compare = (a: IMessage, b: IMessage): number => {
		if (a.createdAt === b.createdAt) {
			return this.compareMessagesTime(a, b);
		} else {
			return a.createdAt - b.createdAt;
		}
	};

	private async retrieveMessageHistoryDesc(
		sender: string | null,
		recipient: Uint256 | null,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		const msgs = await this.indexerHub.requestMessages({
			blockchain: this.subject.blockchain,
			fromBlock: fromMessage ? Number(fromMessage.$$meta.block.number) : null,
			toBlock: toMessage ? Number(toMessage.$$meta.block.number) : null,
			sender,
			recipient,
			type: 'DIRECT',
			limit: limit || 10,
		});

		const toMessageIncluding = false;
		const fromMessageIncluding = false;

		const topBound = toMessage ? msgs.findIndex(r => r.msgId === toMessage.msgId) : -1;
		const bottomBound = fromMessage ? msgs.findIndex(r => r.msgId === fromMessage.msgId) : -1;

		return msgs.slice(
			topBound === -1 ? 0 : (toMessageIncluding ? topBound - 1 : topBound) + 1,
			bottomBound === -1 ? undefined : fromMessageIncluding ? bottomBound + 1 : bottomBound,
		);
	}

	async getBefore(entry: IMessage, limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			const subject = this.subject;
			return await this.indexerHub.retryingOperation(
				async () => {
					return await this.retrieveMessageHistoryDesc(
						subject.sender,
						subject.recipient,
						undefined,
						entry,
						limit,
					);
				},
				async () => {
					return await this.originalSource.getBefore(entry, limit);
				},
			);
		} else {
			return await this.originalSource.getBefore(entry, limit);
		}
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			const subject = this.subject;
			return await this.indexerHub.retryingOperation(
				async () => {
					return await this.retrieveMessageHistoryDesc(
						subject.sender,
						subject.recipient,
						entry,
						undefined,
						limit,
					);
				},
				async () => {
					return await this.originalSource.getAfter(entry, limit);
				},
			);
		} else {
			return await this.originalSource.getAfter(entry, limit);
		}
	}

	async getLast(limit: number, upToIncluding?: IMessage, mutableParams?: any): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			const subject = this.subject;
			return await this.indexerHub.retryingOperation(
				async () => {
					return await this.retrieveMessageHistoryDesc(
						subject.sender,
						subject.recipient,
						undefined,
						undefined,
						limit,
					);
				},
				async () => {
					return await this.originalSource.getLast(limit, upToIncluding, mutableParams);
				},
			);
		} else {
			return await this.originalSource.getLast(limit, upToIncluding, mutableParams);
		}
	}

	protected async pull() {
		const messages = this.lastMessage
			? await this.getAfter(this.lastMessage, this.limit)
			: await this.getLast(this.limit);
		if (messages.length) {
			this.lastMessage = messages[0];
			this.emit('messages', { subject: this.subject, messages });
		}
	}
}
