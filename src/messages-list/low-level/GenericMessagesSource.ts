import { IMessage } from '../../types';
import { asyncTimer } from '../../utils/asyncTimer';
import { LowLevelMessagesSource } from '../types/LowLevelMessagesSource';

/**
 * @internal
 */
export class GenericMessagesSource implements LowLevelMessagesSource {
	protected pullTimer: (() => void) | null = null;
	protected lastMessage: IMessage | null = null;

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: (params: { messages: IMessage[]; afterMsgId: string | undefined }) => void;
	}> = new Set();

	constructor(
		private name: string,
		private compareMessagesTime: (a: IMessage, b: IMessage) => number,
		private retrieveHistoryDesc: (
			fromMessage: IMessage | null,
			toMessage: IMessage | null,
			limit: number,
		) => Promise<IMessage[]>,
		protected _pullCycle: number = 20000,
		public readonly limit = 50,
	) {}

	getName() {
		return this.name;
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
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	private resume(since?: IMessage | undefined): void {
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

	async getBefore(entry: IMessage, limit: number): Promise<IMessage[]> {
		return await this.retrieveHistoryDesc(entry, null, limit);
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		return await this.retrieveHistoryDesc(null, entry, limit);
	}

	async getLast(limit: number): Promise<IMessage[]> {
		return await this.retrieveHistoryDesc(null, null, limit);
	}

	protected async pull() {
		const messages = this.lastMessage
			? await this.getAfter(this.lastMessage, this.limit)
			: await this.getLast(this.limit);
		if (messages.length) {
			this.lastMessage = messages[0];
			for (const subscription of this.newMessagesSubscriptions) {
				subscription.callback({ messages, afterMsgId: this.lastMessage?.msgId });
			}
		}
	}
}
