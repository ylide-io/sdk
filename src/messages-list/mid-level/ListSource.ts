import { AsyncEventEmitter, CriticalSection, ExtendedDoublyLinkedList } from '../../common';
import { IMessage } from '../../types';
import { ListCache } from './ListCache';
import { ListStorage } from './ListStorage';
import { SourceReadingSession } from '../SourceReadingSession';
import { IBlockchainSourceSubject } from '../types/IBlockchainSourceSubject';
import { IListSource } from '../types/IListSource';
import { LowLevelMessagesSource } from '../types/LowLevelMessagesSource';

export class ListSource extends AsyncEventEmitter implements IListSource {
	private readonly cache: ListCache<IMessage>;
	public readonly storage: ListStorage<IMessage>;

	private criticalSection = new CriticalSection();
	private newMessagesCriticalSection = new CriticalSection();

	private _lastSize = 2;
	private _minReadingSize = 10;
	private _paused = true;
	private _drained = false;
	private _drainedByError = false;
	private _newMessagesBlocked = 0;

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
			this.storage = new ListStorage<IMessage>(this.source.compare.bind(this.source), this.cache);
			this.readingSession.storageRepository.set(subject, this.storage);
		}
	}

	compare(a: IMessage, b: IMessage) {
		return this.source.compare(a, b);
	}

	async blockNewMessages() {
		this._newMessagesBlocked++;
		if (this._newMessagesBlocked === 1) {
			await this.newMessagesCriticalSection.enter();
		}
	}

	async unblockNewMessages() {
		this._newMessagesBlocked--;
		if (this._newMessagesBlocked < 0) {
			// eslint-disable-next-line
			console.error('Must never happen: < 0 new messages block');
		}
		if (this._newMessagesBlocked === 0) {
			this.newMessagesCriticalSection.leave();
		}
	}

	get guaranteedSegment(): ExtendedDoublyLinkedList<IMessage> | null {
		return this._paused ? null : this.storage.segments.length ? this.storage.segments[0] : null;
	}

	get paused() {
		return this._paused;
	}

	get drained() {
		return this._drained;
	}

	get drainedByError() {
		return this._drainedByError;
	}

	get guaranteed() {
		return this._paused ? 0 : this.guaranteedSegment?.count() || 0;
	}

	async loadStorage() {
		await this.storage.load();
	}

	private connectToStart(messages: IMessage[]): IMessage[] {
		const lastMessage = this.guaranteedSegment?.head()?.getValue();
		const connectedMessages = messages.concat(lastMessage ? [lastMessage] : []);
		return connectedMessages;
	}

	private handleNewMessages = async ({ messages }: { messages: IMessage[] }) => {
		await this.newMessagesCriticalSection.enter();
		const connectedMessages = this.connectToStart(messages);
		await this.storage.putObjects(connectedMessages, true);
		void this.emit('messages', { messages }, false);
		await this.emit('guaranteedSegmentUpdated');
		this.newMessagesCriticalSection.leave();
	};

	async resume() {
		try {
			if (!this.paused) {
				return;
			}
			await this.criticalSection.enter();
			if (!this.paused) {
				return;
			}
			if (!this.guaranteedSegment) {
				await this.loadStorage();
			}
			const _lastMessage = this.guaranteedSegment?.head().getValue();
			const lastMutableParams = await this.cache.loadLastMutableParams();
			const last = await this.source.getLast(this._lastSize, _lastMessage, lastMutableParams);
			await this.cache.saveLastMutableParams(lastMutableParams);
			if (last.length < this._lastSize) {
				this._drained = true;
			}
			this._paused = false;
			if (last.length > 0) {
				await this.storage.putObjects(last, true);
				await this.emit('guaranteedSegmentUpdated');
			}
			const lastMessage = this.guaranteedSegment?.head()?.getValue();
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			this.source.on('messages', this.handleNewMessages);
			this.source.resume(lastMessage);
		} catch (err) {
			this._paused = false;
			this._drainedByError = true;
			this._drained = true;
			await this.emit('guaranteedSegmentUpdated');
			// eslint-disable-next-line
			console.error('ListSource err: ', err);
			// debugger;
		} finally {
			this.criticalSection.leave();
		}
	}

	pause() {
		this.source.pause();
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.source.off('messages', this.handleNewMessages);
		this._paused = true;
	}

	async readUntil(length: number) {
		while (this.guaranteed < length && !this.drained) {
			const size = length - this.guaranteed;
			const readSize = Math.max(this._minReadingSize, size);
			await this.readMore(readSize);
		}
	}

	private log(...args: any[]) {
		// console.log('LS: ', ...args);
	}

	async readMore(size: number) {
		try {
			const availableNow = this.guaranteed;
			await this.criticalSection.enter();
			const reducedSize = size - (this.guaranteed - availableNow);
			if (reducedSize <= 0) {
				return;
			}
			if (this._paused) {
				throw new Error(`You can't read more from paused ListSource. Please, resume it first`);
			}
			if (this._drained) {
				return;
			}
			if (!this.guaranteedSegment) {
				const readSize = Math.max(this._minReadingSize, reducedSize);
				const last = await this.source.getLast(readSize);
				if (last.length < readSize) {
					this._drained = true;
				}
				if (last.length > 0) {
					await this.storage.putObjects(last, true);
					await this.emit('guaranteedSegmentUpdated');
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const lastMessage = this.guaranteedSegment!.head()?.getValue();
					this.source.resume(lastMessage);
				}
			} else {
				const lastInSegment = this.guaranteedSegment.tail()?.getValue();
				const readSize = Math.max(this._minReadingSize, reducedSize);
				const newOnes = await this.source.getBefore(lastInSegment, readSize);
				if (newOnes.length < readSize) {
					this._drained = true;
				}
				if (newOnes.length > 0) {
					await this.storage.putObjects([lastInSegment, ...newOnes], true);
					await this.emit('guaranteedSegmentUpdated');
				}
			}
		} catch (err) {
			// eslint-disable-next-line
			console.error('readNext err: ', err);
			this._drainedByError = true;
			this._drained = true;
			await this.emit('guaranteedSegmentUpdated');
		} finally {
			this.criticalSection.leave();
		}
	}
}
