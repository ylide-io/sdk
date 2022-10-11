import { DoublyLinkedList } from 'datastructures-js';
import { IMessage } from '../../types';
import { IListSource } from './types/IListSource';
import { AsyncEventEmitter } from './utils/AsyncEventEmitter';
import { CriticalSection } from './utils/CriticalSection';

export interface ListWrappedSource {
	source: IListSource;
	newMessages: number;
	gotUpdate: number;
	newMessagesHandler: (params: { messages: IMessage[] }) => Promise<void>;
	segmentUpdateHandler: () => Promise<void>;
}

export interface IMessageWithSource {
	msg: IMessage;
	source: IListSource;
}

export class ListSourceMultiplexer extends AsyncEventEmitter {
	private sources: ListWrappedSource[] = [];
	private sourceIndex: Map<IListSource, number> = new Map();

	private criticalSection = new CriticalSection();

	private _minReadingSize: number = 10;
	private _paused: boolean = true;
	private _guaranteedSegment: IMessageWithSource[] = [];

	constructor(sources: IListSource[]) {
		super();
		sources.forEach(s => this.addSource(s));
	}

	get guaranteedSegment() {
		return this._paused ? null : this._guaranteedSegment;
	}

	get paused() {
		return this._paused;
	}

	get drained() {
		return this.sources.every(s => s.source.drained);
	}

	get guaranteed() {
		return this._paused ? 0 : this.guaranteedSegment?.length || 0;
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

	private completeRebuild() {
		this._guaranteedSegment = [];
		if (!this.sources.length) {
			// this._guaranteedSegmentList = DoublyLinkedList.fromArray(this._guaranteedSegment);
			return;
		}
		const sourcesSegments = this.sources
			.map(s => (s.source.guaranteedSegment?.toArray() || []).map(m => ({ msg: m, source: s.source })))
			.flat();
		sourcesSegments.sort((a, b) => this.compare(b, a));
		let guaranteed = 0;
		if (this.sources.every(s => s.source.drained)) {
			guaranteed = this.sources.reduce((p, c) => p + c.source.guaranteed, 0);
		} else {
			guaranteed = Math.min(...this.sources.filter(s => !s.source.drained).map(s => s.source.guaranteed));
			guaranteed += this.sources.reduce((p, c) => p + c.newMessages, 0);
		}
		this._guaranteedSegment = sourcesSegments.slice(0, guaranteed); //.map(f => f.msg);
		// this._guaranteedSegmentList = DoublyLinkedList.fromArray(this._guaranteedSegment);
	}

	private async handleSourceGuaranteedSegmentUpdated(source: ListWrappedSource) {
		source.gotUpdate++;
		this.completeRebuild();
		await this.emit('guaranteedSegmentUpdated');
		// if (this.sourceToFilter.guaranteedSegment) {
		// 	const filteredLastSegment = this.sourceToFilter.guaranteedSegment.toArray().filter(this.filter);
		// 	await this.storage.putObjects(filteredLastSegment, true);
		// 	if (filteredLastSegment.length > 0) {
		// 		this._guaranteedLastSegment = true;
		// 		await this.emit('guaranteedSegmentUpdated');
		// 	}
		// }
	}

	private addSource(source: IListSource) {
		const newMessagesHandler = async ({ messages }: { messages: IMessage[] }) => {
			wrappedSource.newMessages += messages.length;
		};

		const segmentUpdateHandler = async () => {
			await this.handleSourceGuaranteedSegmentUpdated(wrappedSource);
		};

		const wrappedSource: ListWrappedSource = {
			source,
			newMessages: 0,
			gotUpdate: 0,
			newMessagesHandler,
			segmentUpdateHandler,
		};

		this.sourceIndex.set(source, this.sources.push(wrappedSource) - 1);
	}

	// private removeSource(source: IListSource) {
	// 	const idx = this.sourceIndex.get(source);
	// 	if (idx === undefined) {
	// 		return;
	// 	}
	// 	this.sources.splice(idx, 1);
	// 	this.sourceIndex.clear();
	// 	for (let i = 0; i < this.sources.length; i++) {
	// 		this.sourceIndex.set(this.sources[i].source, i);
	// 	}
	// }

	async blockNewMessages() {
		await Promise.all(this.sources.map(async source => source.source.blockNewMessages()));
	}

	async unblockNewMessages() {
		await Promise.all(this.sources.map(async source => source.source.unblockNewMessages()));
	}

	async resume() {
		try {
			await this.criticalSection.enter();
			for (const source of this.sources) {
				source.newMessages = 0;
				source.source.on('messages', source.newMessagesHandler);
				if (!source.source.has('guaranteedSegmentUpdated', source.segmentUpdateHandler)) {
					source.source.on('guaranteedSegmentUpdated', source.segmentUpdateHandler);
				}
			}
			this._paused = false;
			await Promise.all(
				this.sources.map(async source => {
					if (source.source.paused) {
						await source.source.resume();
					} else {
						await this.handleSourceGuaranteedSegmentUpdated(source);
					}
				}),
			);
			this.completeRebuild();
			await this.emit('guaranteedSegmentUpdated');
		} finally {
			await this.criticalSection.leave();
		}
	}

	pause() {
		for (const source of this.sources) {
			source.source.off('messages', source.newMessagesHandler);
			source.source.pause();
		}
	}

	async readUntil(length: number) {
		if (this.guaranteed >= length) {
			return;
		}
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
				throw new Error(`You can't read more from paused ListSourceMultiplexer. Please, resume it first`);
			}
			if (this.drained) {
				return;
			}
			let read = 0;
			while (read < reducedSize && !this.drained) {
				const wasGuaranteed = this.guaranteed;
				const readSize = Math.max(this._minReadingSize, reducedSize - read);
				await Promise.all(
					this.sources.filter(s => !s.source.drained).map(async s => s.source.readMore(readSize)),
				);
				this.completeRebuild();
				// await this.sourceToFilter.readMore(readSize);
				if (this.guaranteedSegment) {
					const newGuaranteed = this.guaranteed;
					read += newGuaranteed - wasGuaranteed;
				} else {
					// do nothing - source is empty, and now it is in the drained state.
					// actually, this should never happen, because if the source is empty -
					// it will get the drained state right after the resume, so this code should be unreachable indeed.
					console.warn('ListSourceMultiplexer: Must be unreachable');
				}
			}
			await this.emit('guaranteedSegmentUpdated');
		} finally {
			await this.criticalSection.leave();
		}
	}
}
