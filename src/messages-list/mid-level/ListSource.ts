import { AsyncEventEmitter } from '../../common/AsyncEventEmitter';
import { CriticalSection } from '../../common/CriticalSection';
import { ExtendedDoublyLinkedList } from '../../common/ExtendedDoublyLinkedList';
import { IMessage } from '../../types/IMessage';
import { SourceReadingSession } from '../SourceReadingSession';
import { IBlockchainSourceSubject, IListSource, LowLevelMessagesSource } from '../types';
import { ListCache } from './ListCache';
import { ListStorage } from './ListStorage';

export class ListSource extends AsyncEventEmitter implements IListSource {
	private readonly cache: ListCache<IMessage>;
	private readonly storage: ListStorage<IMessage>;

	private storageInitializationPromise: Promise<void>;
	private storageInitializationPromiseResolver!: () => void;

	private isListInitializationLoading = false;
	private listInitializationPromise: Promise<void> | null = null;
	private listInitializationPromiseResolver!: () => void;

	private trackingNewMessagesDispose: null | (() => void) = null;

	protected newMessagesSubscriptions: Set<{
		name: string;
		callback: () => void;
	}> = new Set();

	private requestCriticalSection = new CriticalSection();
	private loadingCriticalSection = new CriticalSection();

	constructor(
		public readonly readingSession: SourceReadingSession,
		public readonly subject: IBlockchainSourceSubject,
		public readonly source: LowLevelMessagesSource,
	) {
		super();
		const storage = this.readingSession.storageRepository.get(subject);
		this.cache =
			this.readingSession.cacheRepository.get(subject) ||
			this.readingSession.cacheRepository.set(
				subject,
				new ListCache<IMessage>(this.readingSession.sourceSubjectHash(subject)),
			);
		if (storage) {
			this.storage = storage;
		} else {
			this.storage = new ListStorage<IMessage>(
				`Storage over ${this.getName()}`,
				this.source.compare.bind(this.source),
				this.cache,
			);
			this.readingSession.storageRepository.set(subject, this.storage);
		}
		this.storageInitializationPromise = new Promise<void>(resolve => {
			this.storageInitializationPromiseResolver = resolve;
		});
		this.listInitializationPromise = new Promise<void>(resolve => {
			this.listInitializationPromiseResolver = resolve;
		});
		void this.initializeStorage();
	}

	getName() {
		return `ListSource "${this.subject.id}" over (${this.source.getName()})`;
	}

	compare(a: IMessage, b: IMessage) {
		return this.source.compare(a, b);
	}

	get readToBottom() {
		return this.storage.readToBottom;
	}

	get guaranteedSegment(): ExtendedDoublyLinkedList<IMessage> | null {
		return this.storage.segments.length ? this.storage.segments[0] : null;
	}

	private async ready() {
		await this.initializeList();
	}

	private async initializeStorage() {
		await this.storage.load();
		this.storageInitializationPromiseResolver();
	}

	private async initializeList() {
		if (this.isListInitializationLoading) {
			await this.listInitializationPromise;
			return;
		}
		this.isListInitializationLoading = true;
		await this.storageInitializationPromise;
		// if (this.storage.segments.length) {
		// 	this.listInitializationPromiseResolver();
		// 	return;
		// }
		await this.loadMore('after', 10);
		this.listInitializationPromiseResolver();
	}

	private async loadMore(afterOrBefore: 'after' | 'before', limit = 10) {
		if (this.storage.readToBottom) {
			return;
		}
		await this.loadingCriticalSection.enter();
		const gs = this.guaranteedSegment;
		const before = gs ? gs.tail().getValue() : null;
		const msgs =
			afterOrBefore === 'after'
				? await this.source.getLast(limit)
				: before
				? await this.source.getBefore(before, limit)
				: await this.source.getLast(limit);
		if (msgs.length) {
			if (msgs.length < limit) {
				this.storage.readToBottom = true;
			}
			const connected = afterOrBefore !== 'after' && before ? [before, ...msgs] : msgs;
			try {
				await this.storage.putObjects(connected);
			} catch (err) {
				console.error('StorageError: ', this.getName(), afterOrBefore, before, gs, msgs);
				throw err;
			}
		} else {
			this.storage.readToBottom = true;
			await this.storage.dropToCache();
		}
		this.loadingCriticalSection.leave();
	}

	private async request(name: string, from: IMessage, limit = 10) {
		await this.requestCriticalSection.enter();
		const gs = this.guaranteedSegment;
		if (gs) {
			const findPosition = gs.find(n => n.getValue().msgId === from.msgId);
			if (findPosition) {
				let available = 0;
				let curr = findPosition.getNext();
				while (curr) {
					available++;
					if (available >= limit) {
						break;
					}
					curr = curr.getNext();
				}
				if (available >= limit) {
					return;
				} else {
					await this.loadMore('before', limit - available);
				}
			} else {
				throw new Error('You cant load messages after inexistent message');
			}
		} else {
			await this.loadMore('before', limit);
		}
		this.requestCriticalSection.leave();
	}

	private async handleNewMessages({ messages, afterMsgId }: { messages: IMessage[]; afterMsgId?: string }) {
		await this.requestCriticalSection.enter();
		await this.loadingCriticalSection.enter();
		// if (afterMsgId) {
		// 	const findPosition = this.guaranteedSegment?.find(node => node.getValue().msgId === afterMsgId);
		// 	if (findPosition) {
		// 		messages.push(findPosition.getValue());
		// 	}
		// }
		if (this.guaranteedSegment) {
			if (this.compare(this.guaranteedSegment.head().getValue(), messages[messages.length - 1]) < 0) {
				messages = [...messages, this.guaranteedSegment.head().getValue()];
			}
		}
		await this.storage.putObjects(messages);
		for (const subs of this.newMessagesSubscriptions) {
			subs.callback();
		}
		this.loadingCriticalSection.leave();
		this.requestCriticalSection.leave();
	}

	async connect(subscriptionName: string, newMessagesCallback: () => void) {
		await this.storageInitializationPromise;
		const subscription = { name: subscriptionName, callback: newMessagesCallback };
		this.newMessagesSubscriptions.add(subscription);
		if (this.newMessagesSubscriptions.size === 1) {
			this.trackingNewMessagesDispose = this.source.startTrackingNewMessages(
				`${this.getName()}.tracking`,
				params => {
					this.handleNewMessages(params).catch(e => {
						console.error(e);
					});
				},
			);
			await this.ready();
		}
		return {
			request: this.request.bind(this, subscriptionName),
			dispose: () => {
				this.newMessagesSubscriptions.delete(subscription);
				if (this.newMessagesSubscriptions.size === 0) {
					if (this.trackingNewMessagesDispose) {
						this.trackingNewMessagesDispose();
					} else {
						throw new Error('trackingNewMessagesDispose is not defined');
					}
				}
			},
		};
	}
}
