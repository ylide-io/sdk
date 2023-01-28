import { EventEmitter } from 'eventemitter3';
import { IMessage, Uint256 } from '../../types';
import { asyncTimer } from '../../utils/asyncTimer';
import { LowLevelMessagesSource } from '../types/LowLevelMessagesSource';

/**
 * @internal
 */
export class GenericMessagesSource extends EventEmitter implements LowLevelMessagesSource {
	protected pullTimer: (() => void) | null = null;
	protected lastMessage: IMessage | null = null;

	constructor(
		private compareMessagesTime: (a: IMessage, b: IMessage) => number,
		private retrieveHistoryDesc: (
			fromMessage: IMessage | null,
			toMessage: IMessage | null,
			limit: number,
		) => Promise<IMessage[]>,
		protected _pullCycle: number = 20000,
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

	async getBefore(entry: IMessage, limit: number): Promise<IMessage[]> {
		return await this.retrieveHistoryDesc(null, entry, limit);
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		return await this.retrieveHistoryDesc(entry, null, limit);
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
			this.emit('messages', { meta: this.meta, messages });
		}
	}
}
