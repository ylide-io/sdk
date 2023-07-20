import { CriticalSection } from '../../common';
import { IMessage } from '../../types/IMessage';
import { IMessageWithSource, ListSourceMultiplexer } from './ListSourceMultiplexer';

export class ListSourceDrainer {
	private _messages: IMessageWithSource[] = [];

	private _filled = 0;
	private _minReadingSize = 10;
	private _newMessagesAvailable = 0;

	private _filter: null | ((m: IMessageWithSource) => void) = null;

	private requestCriticalSection = new CriticalSection();

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: () => void;
	}> = new Set();

	private _disposer: null | (() => void) = null;
	private _requester: null | ((from: IMessage, limit: number) => Promise<void>) = null;

	constructor(public readonly source: ListSourceMultiplexer) {}

	get guaranteed() {
		return this._filled;
	}

	private filter = (m: IMessageWithSource) => {
		return this._filter ? this._filter(m) : true;
	};

	async resetFilter(newFilter: null | ((m: IMessageWithSource) => void)) {
		await this.requestCriticalSection.enter();
		this._filter = newFilter;
		this.recalcMessages();
		this._filled = Math.min(this._minReadingSize, this._messages.length);
		this.requestCriticalSection.leave();
	}

	recalcMessages() {
		this._messages = this.source.guaranteedSegment.filter(this.filter);
	}

	get messages() {
		return this._messages.slice(0, this._filled);
	}

	get readToBottom() {
		return this.source.readToBottom && this._filled === this._messages.length;
	}

	get newMessagesCount() {
		return this._newMessagesAvailable;
	}

	public async drainNewMessages() {
		await this.requestCriticalSection.enter();
		const newMessagesCount = this._newMessagesAvailable;
		await this.source.drainNewMessages();
		this.recalcMessages();
		this._filled += newMessagesCount;
		this._newMessagesAvailable = 0;
		this.requestCriticalSection.leave();
	}

	private onNewMessages() {
		this._newMessagesAvailable = this.source.newMessagesNonSorted.filter(this.filter).length;
		this.newMessagesSubscriptions.forEach(g => g.callback());
	}

	private async requestRaw(name: string, from: IMessage, limit = 10) {
		const idx = this._messages.findIndex(m => m.msg.msgId === from.msgId);
		if (idx === -1) {
			throw new Error('You cant load messages after inexistent message');
		}
		const available = this._messages.length - idx - 1;
		if (available >= limit) {
			return;
		}
		if (this.readToBottom) {
			return;
		}
		const needToReed = limit - available;
		if (!this._requester) {
			throw new Error('You cant load messages before connect');
		}
		if (this.source.readToBottom) {
			return;
		}
		const toRead = Math.max(needToReed, this._minReadingSize);
		await this._requester(this.source.guaranteedSegment[this.source.guaranteedSegment.length - 1].msg, toRead);

		this.recalcMessages();
	}

	private async request(name: string, from: IMessage, limit = 10) {
		await this.requestCriticalSection.enter();
		const idx = this._messages.findIndex(m => m.msg.msgId === from.msgId);
		if (idx === -1) {
			throw new Error('You cant load messages after inexistent message');
		}
		let available = this._messages.length - idx - 1;
		while (available < limit && !this.source.readToBottom) {
			await this.requestRaw(name, from, limit - available);
			available = this._messages.length - idx - 1;
		}

		let newFilled = idx + 1 + limit;
		if (newFilled > this._messages.length) {
			newFilled = this._messages.length;
		}
		this._filled = newFilled;

		this.requestCriticalSection.leave();
	}

	async loadNextPage(name: string) {
		if (this.readToBottom) {
			return;
		}
		if (this._messages.length === 0) {
			throw new Error('You cant load messages before connect');
		}
		await this.request(name, this._messages[this._messages.length - 1].msg, this._minReadingSize);
	}

	async connect(subscriptionName: string, newMessagesCallback: () => void) {
		const subscription = { name: subscriptionName, callback: newMessagesCallback };
		this.newMessagesSubscriptions.add(subscription);
		if (this.newMessagesSubscriptions.size === 1) {
			const { request, dispose } = await this.source.connect(`Drainer`, this.onNewMessages.bind(this));
			this._requester = request;
			this._disposer = dispose;
			this.recalcMessages();
			this._filled = Math.min(this._minReadingSize, this._messages.length);
		}
		return {
			request: this.request.bind(this, subscriptionName),
			loadNextPage: this.loadNextPage.bind(this, subscriptionName),
			dispose: () => {
				this.newMessagesSubscriptions.delete(subscription);
				if (this.newMessagesSubscriptions.size === 0) {
					if (!this._disposer) {
						throw new Error('You cant dispose before connect');
					}
					this._disposer();
				}
			},
		};
	}
}
