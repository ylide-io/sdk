/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DoublyLinkedListNode } from '@datastructures-js/linked-list';
import { CriticalSection } from '../../common';
import { IMessage } from '../../types';
import { IListSource } from '../types';

export interface ListWrappedSource {
	source: IListSource;
	meta: any;
	newMessagesCount: number;

	firstMsg: DoublyLinkedListNode<IMessage> | null;
	lastUsedMsg: DoublyLinkedListNode<IMessage> | null;
	guaranteed: number;

	dispose: () => void;
	request: (from: IMessage, limit?: number) => Promise<void>;
}

export interface IMessageWithSource {
	msg: IMessage;
	meta: any;
	source: IListSource;
}

export interface ISourceWithMeta {
	source: IListSource;
	meta?: any;
}

export class ListSourceMultiplexer {
	private sources: ListWrappedSource[] = [];
	private sourceIndex: Map<IListSource, number> = new Map();

	private _guaranteedSegment: IMessageWithSource[] = [];
	private _guaranteed = 0;
	private _minReadingSize = 10;

	private requestCriticalSection = new CriticalSection();

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: () => void;
	}> = new Set();

	constructor(sources: ISourceWithMeta[]) {
		sources.forEach(s => this.addSource(s.source, s.meta));
	}

	get readToBottom() {
		return this.sources.every(s => s.source.readToBottom);
	}

	get guaranteedSegment() {
		return this._guaranteedSegment;
	}

	get newMessagesCount() {
		return this.sources.reduce((p, c) => p + c.newMessagesCount, 0);
	}

	get newMessagesNonSorted() {
		const msgs: IMessageWithSource[] = [];
		for (const source of this.sources) {
			let startInner = source.firstMsg?.getPrev();
			while (startInner) {
				msgs.push({
					msg: startInner.getValue(),
					meta: source.meta,
					source: source.source,
				});
				startInner = startInner.getPrev();
			}
		}
		return msgs;
	}

	private addSource(source: IListSource, meta?: any) {
		const wrappedSource: ListWrappedSource = {
			source,
			meta,
			newMessagesCount: 0,

			firstMsg: null,
			lastUsedMsg: null,
			guaranteed: 0,

			// eslint-disable-next-line @typescript-eslint/no-empty-function
			dispose: () => {},
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			request: async (from: IMessage, limit?: number) => {},
		};

		this.sourceIndex.set(source, this.sources.push(wrappedSource) - 1);
	}

	private compare(a: { source: IListSource; msg: IMessage }, b: { source: IListSource; msg: IMessage }): number {
		if (a.msg.createdAt === b.msg.createdAt) {
			const aSourceIdx = this.sourceIndex.get(a.source)!;
			const bSourceIdx = this.sourceIndex.get(b.source)!;
			if (aSourceIdx === bSourceIdx) {
				return a.source.compare(a.msg, b.msg);
			} else {
				return aSourceIdx - bSourceIdx;
			}
		} else {
			return a.msg.createdAt - b.msg.createdAt;
		}
	}

	private log(...args: any[]) {
		// console.log('LSM: ', ...args);
	}

	private handleNewMessages(s: ListWrappedSource) {
		let newMessagesCount = 0;
		let firstMsg: DoublyLinkedListNode<IMessage> | null = s.source.guaranteedSegment?.head() || null;
		if (!s.firstMsg) {
			s.newMessagesCount = s.source.guaranteedSegment?.count() || 0;
		} else {
			while (firstMsg && firstMsg.getValue().msgId !== s.firstMsg?.getValue().msgId) {
				newMessagesCount++;
				firstMsg = firstMsg.getNext();
			}
			s.newMessagesCount = newMessagesCount;
		}
		this.newMessagesSubscriptions.forEach(g => g.callback());
	}

	private async connectSources() {
		await Promise.all(
			this.sources.map(async s => {
				const { dispose, request } = await s.source.connect(
					'Multiplexer',
					this.handleNewMessages.bind(this, s),
				);
				s.dispose = dispose;
				s.request = request;
			}),
		);
		await Promise.all(
			this.sources.map(async s => {
				s.lastUsedMsg = s.source.guaranteedSegment?.tail() || null;
				if (!s.firstMsg) {
					s.firstMsg = s.source.guaranteedSegment?.head() || null;
				}
				let g = 0;
				let t = s.firstMsg;
				while (t) {
					g++;
					t = t.getNext();
				}
				s.guaranteed = g;
			}),
		);
		this.recalcGuaranteed();
		this.recalcSegments();
	}

	private disconnectSources() {
		this.sources.forEach(s => s.dispose());
	}

	private recalcGuaranteed() {
		let guaranteed = 0;
		if (this.sources.every(s => s.source.readToBottom)) {
			guaranteed = this.sources.reduce((p, c) => p + c.guaranteed, 0);
		} else {
			guaranteed = Math.min(...this.sources.filter(s => !s.source.readToBottom).map(s => s.guaranteed));
		}
		this._guaranteed = guaranteed;
	}

	private recalcNewMessages() {
		for (const source of this.sources) {
			source.firstMsg = source.source.guaranteedSegment?.head() || null;
			if (!source.lastUsedMsg) {
				source.lastUsedMsg = source.source.guaranteedSegment?.tail() || null;
			}
			source.guaranteed += source.newMessagesCount;
			source.newMessagesCount = 0;
		}
	}

	private recalcSegments() {
		this._guaranteedSegment = [];
		if (!this.sources.length) {
			return;
		}
		const sourcesSegments = this.sources
			.map(s => {
				if (s.source.guaranteedSegment) {
					if (!s.firstMsg) {
						return [];
					} else {
						const msgs = [];
						for (let start = s.firstMsg; start !== s.lastUsedMsg?.getNext(); start = start.getNext()) {
							msgs.push({
								msg: start.getValue(),
								meta: s.meta,
								source: s.source,
							});
						}
						return msgs;
					}
				} else {
					return [];
				}
			})
			.flat();
		sourcesSegments.sort((a, b) => this.compare(b, a));
		this._guaranteedSegment = sourcesSegments.slice(0, this._guaranteed);
	}

	public async drainNewMessages() {
		await this.requestCriticalSection.enter();
		this.recalcNewMessages();
		this.recalcGuaranteed();
		this.recalcSegments();
		this.requestCriticalSection.leave();
	}

	private async request(name: string, before: IMessage, limit = 10) {
		await this.requestCriticalSection.enter();
		try {
			const idx = this._guaranteedSegment.findIndex(m => m.msg.msgId === before.msgId);
			if (idx === -1) {
				throw new Error(`Message ${before.msgId} not found in the list`);
			}
			const availableNow = this._guaranteed - idx - 1;
			if (availableNow >= limit) {
				return;
			}
			const reducedSize = limit - availableNow;
			if (this.readToBottom) {
				return;
			}
			const readSize = Math.max(this._minReadingSize, reducedSize);
			await Promise.all(
				this.sources.map(async s => {
					if (s.source.readToBottom) {
						return;
					}
					if (!s.lastUsedMsg) {
						throw new Error('lastUsedMsg is null, should be impossible here');
					}
					await s.request(s.lastUsedMsg.getValue(), readSize);
					s.lastUsedMsg = s.source.guaranteedSegment?.tail() || null;
					if (!s.firstMsg) {
						s.firstMsg = s.source.guaranteedSegment?.head() || null;
					}
					let g = 0;
					let t = s.firstMsg;
					while (t) {
						g++;
						t = t.getNext();
					}
					s.guaranteed = g;
				}),
			);
			this.recalcGuaranteed();
			this.recalcSegments();
		} finally {
			this.requestCriticalSection.leave();
		}
	}

	async connect(subscriptionName: string, newMessagesCallback: () => void) {
		const subscription = { name: subscriptionName, callback: newMessagesCallback };
		this.newMessagesSubscriptions.add(subscription);
		if (this.newMessagesSubscriptions.size === 1) {
			await this.connectSources();
		}
		return {
			request: this.request.bind(this, subscriptionName),
			dispose: () => {
				this.newMessagesSubscriptions.delete(subscription);
				if (this.newMessagesSubscriptions.size === 0) {
					this.disconnectSources();
				}
			},
		};
	}

	// async readUntil(length: number) {
	// 	if (this._guaranteed >= length) {
	// 		return;
	// 	}
	// 	while (this._guaranteed < length && !this.readToBottom) {
	// 		const size = length - this._guaranteed;
	// 		const readSize = Math.max(this._minReadingSize, size);
	// 		await this.request('InternalLoad readUntil', readSize);
	// 	}
	// }
}
