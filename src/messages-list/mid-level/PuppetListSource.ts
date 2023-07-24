import { AsyncEventEmitter, CriticalSection } from '../../common';
import { IMessage } from '../../types';
import { SourceReadingSession } from '../SourceReadingSession';
import { IBlockchainSourceSubject } from '../types/IBlockchainSourceSubject';
import { IListSource } from '../types/IListSource';
import { DoublyLinkedList, DoublyLinkedListNode } from '@datastructures-js/linked-list';

export class PuppetListSource extends AsyncEventEmitter implements IListSource {
	private _messages: DoublyLinkedList<IMessage> | undefined;
	private _minReadingSize = 10;

	private requestCriticalSection = new CriticalSection();
	private connectCriticalSection = new CriticalSection();

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: () => void;
	}> = new Set();

	private _disposer: null | (() => void) = null;
	private _requester: null | ((from: IMessage, limit: number) => Promise<void>) = null;

	constructor(
		public readonly readingSession: SourceReadingSession,
		public readonly subject: IBlockchainSourceSubject,
		public readonly sourceToFilter: IListSource,
	) {
		super();
	}

	getName() {
		return `PuppetListSource "${this.subject.id}" over (${this.sourceToFilter.getName()})`;
	}

	compare(a: IMessage, b: IMessage) {
		return this.sourceToFilter.compare(a, b);
	}

	private filter = (m: DoublyLinkedListNode<IMessage>) => {
		return m.getValue().senderAddress.toLowerCase() === this.subject.sender?.toLowerCase();
	};

	get guaranteedSegment() {
		return this._messages ? this._messages : null;
	}

	get readToBottom() {
		return this.sourceToFilter.readToBottom;
	}

	private onNewMessages() {
		if (!this._messages) {
			if (!this.sourceToFilter.guaranteedSegment) {
				return;
			} else {
				this._messages = this.sourceToFilter.guaranteedSegment.filter(this.filter);
				this.newMessagesSubscriptions.forEach(s => s.callback());
			}
		} else {
			let startInner = this._messages.tail();
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			for (let element = this.sourceToFilter.guaranteedSegment!.tail(); element; element = element.getPrev()) {
				if (this.filter(element)) {
					if (startInner === null) {
						this._messages.insertFirst(element.getValue());
					} else {
						if (startInner.getValue().msgId !== element.getValue().msgId) {
							console.log('PuppetListSource: NOT OK');
						} else {
							startInner = startInner.getPrev();
						}
					}
				}
			}
			this.newMessagesSubscriptions.forEach(s => s.callback());
		}
	}

	private async requestRaw(name: string, from: IMessage | null, limit = 10) {
		if (!this._messages || !this.sourceToFilter.guaranteedSegment) {
			throw new Error('You cant load messages after inexistent message');
		}
		let idx = null;
		let available = 0;
		if (from) {
			idx = this._messages.find(m => m.getValue().msgId === from.msgId);
			if (!idx) {
				throw new Error('You cant load messages after inexistent message');
			}
			let curr = idx ? idx.getNext() : null;
			while (curr) {
				available++;
				curr = curr.getNext();
			}
		} else {
			available = this._messages.count();
		}
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
		if (this.sourceToFilter.readToBottom) {
			return;
		}
		const toRead = Math.max(needToReed, this._minReadingSize);
		await this._requester(this.sourceToFilter.guaranteedSegment.tail().getValue(), toRead);

		let startInner = this._messages.head();
		for (let element = this.sourceToFilter.guaranteedSegment.head(); element; element = element.getNext()) {
			if (this.filter(element)) {
				if (startInner === null) {
					this._messages.insertLast(element.getValue());
				} else {
					if (startInner.getValue().msgId !== element.getValue().msgId) {
						console.log('PuppetListSource: NOT OK');
					} else {
						startInner = startInner.getNext();
					}
				}
			}
		}
	}

	private async request(name: string, from: IMessage | null, limit = 10) {
		await this.requestCriticalSection.enter();
		if (!this._messages || !this.sourceToFilter.guaranteedSegment) {
			throw new Error('You cant load messages after inexistent message');
		}
		let idx = null;
		let available = 0;
		if (from) {
			idx = this._messages.find(m => m.getValue().msgId === from.msgId);
			if (!idx) {
				throw new Error('You cant load messages after inexistent message');
			}
			let curr = idx ? idx.getNext() : null;
			while (curr) {
				available++;
				curr = curr.getNext();
			}
		} else {
			available = this._messages.count();
		}
		while (available < limit && !this.sourceToFilter.readToBottom) {
			await this.requestRaw(name, from, limit);
			if (idx) {
				available = 0;
				let curr = idx.getNext();
				while (curr) {
					available++;
					curr = curr.getNext();
				}
			} else {
				available = this._messages.count();
			}
		}

		this.requestCriticalSection.leave();
	}

	async connect(subscriptionName: string, newMessagesCallback: () => void) {
		await this.connectCriticalSection.enter();
		const subscription = { name: subscriptionName, callback: newMessagesCallback };
		this.newMessagesSubscriptions.add(subscription);
		if (this.newMessagesSubscriptions.size === 1) {
			const { request, dispose } = await this.sourceToFilter.connect(`Drainer`, this.onNewMessages.bind(this));
			this._requester = request;
			this._disposer = dispose;
			this._messages = this.sourceToFilter.guaranteedSegment?.filter(this.filter);
			if (this._messages?.count() === 0) {
				await this.request(subscriptionName, null, this._minReadingSize);
			}
		}
		this.connectCriticalSection.leave();
		return {
			request: this.request.bind(this, subscriptionName),
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
