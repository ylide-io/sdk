/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AsyncEventEmitter, CriticalSection } from '../../common';
import { IMessage } from '../../types';
import { IListSource } from '../types/IListSource';

export interface ListWrappedSource {
	source: IListSource;
	meta: any;
	newMessages: number;
	gotUpdate: number;
	newMessagesHandler: (params: { messages: IMessage[] }) => Promise<void>;
	segmentUpdateHandler: () => Promise<void>;
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

export class ListSourceMultiplexer extends AsyncEventEmitter {
	private sources: ListWrappedSource[] = [];
	private sourceIndex: Map<IListSource, number> = new Map();

	private criticalSection = new CriticalSection();

	private _minReadingSize = 10;
	private _paused = true;
	private _guaranteedSegment: IMessageWithSource[] = [];

	constructor(sources: ISourceWithMeta[]) {
		super();
		sources.forEach(s => this.addSource(s.source, s.meta));
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
		this.log('completeRebuild()');
		this._guaranteedSegment = [];
		if (!this.sources.length) {
			return;
		}
		const sourcesSegments = this.sources
			.map(s =>
				(s.source.guaranteedSegment?.toArray() || []).map(m => ({ msg: m, meta: s.meta, source: s.source })),
			)
			.flat();
		sourcesSegments.sort((a, b) => this.compare(b, a));
		this.log('sourcesSegments', sourcesSegments);
		let guaranteed = 0;
		if (this.sources.every(s => s.source.drained)) {
			guaranteed = this.sources.reduce((p, c) => p + c.source.guaranteed, 0);
		} else {
			guaranteed = Math.min(...this.sources.filter(s => !s.source.drained).map(s => s.source.guaranteed));
			guaranteed += this.sources.reduce((p, c) => p + c.newMessages, 0);
		}
		this._guaranteedSegment = sourcesSegments.slice(0, guaranteed);
		this.log('guaranteedSegment', this._guaranteedSegment);
	}

	private async handleSourceGuaranteedSegmentUpdated(source: ListWrappedSource) {
		source.gotUpdate++;
		this.completeRebuild();
		await this.emit('guaranteedSegmentUpdated');
	}

	private addSource(source: IListSource, meta?: any) {
		const newMessagesHandler = async ({ messages }: { messages: IMessage[] }) => {
			wrappedSource.newMessages += messages.length;
		};

		const segmentUpdateHandler = async () => {
			await this.handleSourceGuaranteedSegmentUpdated(wrappedSource);
		};

		const wrappedSource: ListWrappedSource = {
			source,
			meta,
			newMessages: 0,
			gotUpdate: 0,
			newMessagesHandler,
			segmentUpdateHandler,
		};

		this.sourceIndex.set(source, this.sources.push(wrappedSource) - 1);
	}

	async blockNewMessages() {
		await Promise.all(this.sources.map(async source => source.source.blockNewMessages()));
	}

	async unblockNewMessages() {
		await Promise.all(this.sources.map(async source => source.source.unblockNewMessages()));
	}

	async resume() {
		try {
			this.log('resume()');
			await this.criticalSection.enter();
			for (const source of this.sources) {
				source.newMessages = 0;
				source.source.on('messages', source.newMessagesHandler);
				if (!source.source.has('guaranteedSegmentUpdated', source.segmentUpdateHandler)) {
					source.source.on('guaranteedSegmentUpdated', source.segmentUpdateHandler);
				}
			}
			this.log('sources', this.sources);
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
			this.log('sources', this.sources);
			this.completeRebuild();
			await this.emit('guaranteedSegmentUpdated');
		} finally {
			this.criticalSection.leave();
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
			this.log('readMore()', size);
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
			this.log('readMore() - reducedSize', reducedSize);
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
					// eslint-disable-next-line
					console.warn('ListSourceMultiplexer: Must be unreachable');
				}
			}
			this.log('readMore() - read', read);
			await this.emit('guaranteedSegmentUpdated');
		} finally {
			this.criticalSection.leave();
		}
	}
}
