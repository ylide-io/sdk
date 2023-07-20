import { EventEmitter } from 'eventemitter3';
import { IndexerHub } from '.';
import { IMessage, Uint256 } from '../types';
import { asyncTimer } from '../utils';
import { BlockchainSourceType, IBlockchainSourceSubject } from '../messages-list/types';
import { LowLevelMessagesSource } from '../messages-list/types/LowLevelMessagesSource';
import { randomBytes } from '../crypto';
import SmartBuffer from '@ylide/smart-buffer';

/**
 * @internal
 */
export class IndexerMessagesSource extends EventEmitter implements LowLevelMessagesSource {
	protected pullTimer: (() => void) | null = null;
	protected lastMessage: IMessage | null = null;
	public readonly channel: string = new SmartBuffer(randomBytes(32)).toHexString();

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: (params: { messages: IMessage[]; afterMsgId: string | undefined }) => void;
	}> = new Set();

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

	startTrackingNewMessages(
		subscriptionName: string,
		// since: IMessage | undefined,
		callback: (params: { messages: IMessage[]; afterMsgId: string | undefined }) => void,
	) {
		const subscription = { name: subscriptionName, callback };
		this.newMessagesSubscriptions.add(subscription);
		if (this.newMessagesSubscriptions.size === 1) {
			this.resume();
		}
		return () => {
			this.newMessagesSubscriptions.delete(subscription);
			if (this.newMessagesSubscriptions.size === 0) {
				this.pause();
			}
		};
	}

	private pause() {
		if (this.indexerHub.useWebSocketPulling) {
			this.indexerHub.unsubscribe(this);
		} else {
			if (this.pullTimer) {
				this.pullTimer();
			}
		}
	}

	private resume(since?: IMessage | undefined): void {
		this.lastMessage = since || null;
		if (this.indexerHub.useWebSocketPulling) {
			this.indexerHub.subscribe(this);
		} else {
			if (!this.pullTimer) {
				this.pullTimer = asyncTimer(this.pull.bind(this), this._pullCycle);
			}
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
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		const msgs = await this.indexerHub.requestMessages({
			blockchain: this.subject.blockchain,
			fromBlock: fromMessage ? Number(fromMessage.$$meta.block.number) : null,
			toBlock: toMessage ? Number(toMessage.$$meta.block.number) : null,
			fromMessage: fromMessage
				? {
						blockNumber: String(fromMessage.$$meta.event.blockNumber),
						transactionIndex: fromMessage.$$meta.event.transactionIndex,
						logIndex: fromMessage.$$meta.event.logIndex,
				  }
				: null,
			toMessage: toMessage
				? {
						blockNumber: String(toMessage.$$meta.event.blockNumber),
						transactionIndex: toMessage.$$meta.event.transactionIndex,
						logIndex: toMessage.$$meta.event.logIndex,
				  }
				: null,
			sender: this.subject.sender,
			recipient: this.subject.type === BlockchainSourceType.DIRECT ? this.subject.recipient : null,
			feedId: this.subject.feedId,
			mailerId: this.subject.id,
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
			return await this.indexerHub.retryingOperation(
				() => this.retrieveMessageHistoryDesc(undefined, entry, limit),
				() => this.originalSource.getBefore(entry, limit),
			);
		} else {
			return await this.originalSource.getBefore(entry, limit);
		}
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return await this.indexerHub.retryingOperation(
				() => this.retrieveMessageHistoryDesc(entry, undefined, limit),
				() => this.originalSource.getAfter(entry, limit),
			);
		} else {
			return await this.originalSource.getAfter(entry, limit);
		}
	}

	async getLast(limit: number, upToIncluding?: IMessage, mutableParams?: any): Promise<IMessage[]> {
		if (this.subject.type === BlockchainSourceType.DIRECT) {
			return await this.indexerHub.retryingOperation(
				async () => this.retrieveMessageHistoryDesc(undefined, undefined, limit),
				async () => this.originalSource.getLast(limit, upToIncluding, mutableParams),
			);
		} else {
			return await this.originalSource.getLast(limit, upToIncluding, mutableParams);
		}
	}

	drainNewMessages(messages: IMessage[]) {
		if (messages.length) {
			this.lastMessage = messages[0];
			this.newMessagesSubscriptions.forEach(s => s.callback({ messages, afterMsgId: undefined }));
		}
	}

	protected async pull() {
		const messages = this.lastMessage
			? await this.getAfter(this.lastMessage, this.limit)
			: await this.getLast(this.limit);
		this.drainNewMessages(messages);
	}
}
