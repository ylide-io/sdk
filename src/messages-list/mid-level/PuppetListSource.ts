import { AsyncEventEmitter, CriticalSection } from '../../common';
import { IMessage } from '../../types';
import { ListCache } from './ListCache';
import { ListSource } from './ListSource';
import { ListStorage } from './ListStorage';
import { SourceReadingSession } from '../SourceReadingSession';
import { IBlockchainSourceSubject } from '../types/IBlockchainSourceSubject';
import { IListSource } from '../types/IListSource';
import { isWideSubject } from '../utils';

export class PuppetListSource extends AsyncEventEmitter implements IListSource {
	private readonly cache: ListCache<IMessage>;
	public readonly storage: ListStorage<IMessage>;

	private criticalSection = new CriticalSection();

	private _minReadingSize = 10;
	private _paused = true;
	private _guaranteedLastSegment = false;

	constructor(
		public readonly readingSession: SourceReadingSession,
		public readonly subject: IBlockchainSourceSubject,
		public readonly sourceToFilter: IListSource,
	) {
		super();
		if (!isWideSubject(subject)) {
			throw new Error('PuppetListSource can be used only for reading for a certain recipients');
		}

		this.cache =
			this.readingSession.cacheRepository.get(subject) ||
			this.readingSession.cacheRepository.set(
				subject,
				new ListCache<IMessage>(this.readingSession.sourceSubjectHash(subject)),
			);
		this.storage =
			this.readingSession.storageRepository.get(subject) ||
			this.readingSession.storageRepository.set(
				subject,
				new ListStorage<IMessage>(
					`Storage over ${this.getName()}`,
					this.sourceToFilter.compare.bind(this.sourceToFilter),
					this.cache,
				),
			);
	}

	getName() {
		return `PuppetListSource "${this.subject.id}" over (${this.sourceToFilter.getName()})`;
	}

	compare(a: IMessage, b: IMessage) {
		return this.sourceToFilter.compare(a, b);
	}

	async blockNewMessages() {
		await this.sourceToFilter.blockNewMessages();
	}

	async unblockNewMessages() {
		await this.sourceToFilter.unblockNewMessages();
	}

	get guaranteedSegment() {
		return this._guaranteedLastSegment && this.storage.segments.length ? this.storage.segments[0] : null;
	}

	get paused() {
		return this._paused;
	}

	get drained() {
		return this.sourceToFilter.drained;
	}

	get guaranteed() {
		return this._paused ? 0 : this._guaranteedLastSegment ? this.guaranteedSegment?.count() || 0 : 0;
	}

	async loadStorage() {
		await this.storage.load();
	}

	private connectToStart(messages: IMessage[]): IMessage[] {
		const lastMessage = this._guaranteedLastSegment ? this.guaranteedSegment?.head()?.getValue() : null;
		const connectedMessages = messages.concat(lastMessage ? [lastMessage] : []);
		return connectedMessages;
	}

	private connectToEnd(messages: IMessage[]): IMessage[] {
		const firstMessage = this._guaranteedLastSegment ? this.guaranteedSegment?.tail()?.getValue() : null;
		const connectedMessages = (firstMessage ? [firstMessage] : []).concat(messages);
		return connectedMessages;
	}

	private filter = (m: IMessage) => {
		return m.senderAddress === this.subject.sender;
	};

	private log(...args: any[]) {
		// console.log('PLS: ', ...args);
	}

	private handleSourceGuaranteedSegmentUpdated = async () => {
		if (this.sourceToFilter.guaranteedSegment) {
			const filteredLastSegment = this.sourceToFilter.guaranteedSegment.toArray().filter(this.filter);
			await this.storage.putObjects(filteredLastSegment, true);
			if (filteredLastSegment.length > 0) {
				this._guaranteedLastSegment = true;
				await this.emit('guaranteedSegmentUpdated');
			}
		}
	};

	private handleNewMessages = async ({ messages }: { messages: IMessage[] }) => {
		const filteredMessages = messages.filter(this.filter);
		if (!filteredMessages.length) {
			return;
		}
		const connectedMessages = this.connectToStart(filteredMessages);
		await this.storage.putObjects(connectedMessages, true);
		this._guaranteedLastSegment = true;
		void this.emit('messages', { messages: filteredMessages }, false);
	};

	async resume() {
		try {
			await this.criticalSection.enter();
			this.sourceToFilter.on('messages', this.handleNewMessages);
			if (!this.sourceToFilter.has('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated)) {
				this.sourceToFilter.on('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated);
			}
			this._paused = false;
			if (this.sourceToFilter.paused) {
				await this.sourceToFilter.resume();
			} else {
				await this.handleSourceGuaranteedSegmentUpdated();
			}
		} finally {
			this.criticalSection.leave();
		}
	}

	pause() {
		this.sourceToFilter.off('messages', this.handleNewMessages);
		this._guaranteedLastSegment = false;
		this._paused = true;
	}

	async readUntil(length: number) {
		while (this.guaranteed < length && !this.drained) {
			const size = length - this.guaranteed;
			const readSize = Math.max(this._minReadingSize, size);
			await this.readMore(readSize);
		}
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
				throw new Error(`You can't read more from paused PuppetListSource. Please, resume it first`);
			}
			if (this.drained) {
				return;
			}
			let read = 0;
			while (read < reducedSize && !this.drained) {
				const wasGuaranteed = this.guaranteed;
				const readSize = Math.max(this._minReadingSize, reducedSize - read);
				await this.sourceToFilter.readMore(readSize);
				if (this.sourceToFilter.guaranteedSegment) {
					const newGuaranteed = this.guaranteed;
					read += newGuaranteed - wasGuaranteed;
				} else {
					// do nothing - source is empty, and now it is in the drained state.
					// actually, this should never happen, because if the source is empty -
					// it will get the drained state right after the resume, so this code should be unreachable indeed.
					// eslint-disable-next-line no-console
					console.warn('PuppetListSource: Must be unreachable');
				}
			}
		} finally {
			this.criticalSection.leave();
		}
	}
}
