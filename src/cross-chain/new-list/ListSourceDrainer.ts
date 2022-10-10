import { IMessageWithSource, ListSourceMultiplexer } from './ListSourceMultiplexer';
import { AsyncEventEmitter } from './utils/AsyncEventEmitter';
import { CriticalSection } from './utils/CriticalSection';

export class ListSourceDrainer extends AsyncEventEmitter {
	private criticalSection = new CriticalSection();
	private _messages: IMessageWithSource[] = [];
	private _filled: number = 0;
	private _isReading = false;
	private _paused: boolean = true;
	private _minReadingSize = 10;
	private _filter: null | ((m: IMessageWithSource) => void) = null;

	constructor(public readonly source: ListSourceMultiplexer) {
		super();
	}

	get paused() {
		return this._paused;
	}

	get guaranteed() {
		return this._filled;
	}

	private filter = (m: IMessageWithSource) => {
		return this._filter ? this._filter(m) : true;
	};

	private handleSourceGuaranteedSegmentUpdated = async () => {
		if (this.source.guaranteedSegment) {
			const beforeSize = this._messages.length;
			this._messages = this.source.guaranteedSegment.filter(this.filter);
			if (!this._isReading) {
				this._filled += this._messages.length - beforeSize;
			}
		}
	};

	resetFilter(newFilter: null | ((m: IMessageWithSource) => void)): IMessageWithSource[] {
		this._filter = newFilter;
		this._filled = 0;
		this._messages = [];
		if (this.source.guaranteedSegment) {
			this._messages = this.source.guaranteedSegment.filter(this.filter);
		}
		return [];
	}

	async resume() {
		if (!this.source.has('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated)) {
			this.source.on('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated);
		}
		await this.source.resume();
		return this._messages.slice(0, this._filled);
	}

	pause() {
		this.source.pause();
	}

	get drained() {
		return this.source.drained && this._filled === this._messages.length;
	}

	async readUntil(length: number) {
		try {
			await this.source.blockNewMessages();
			while (this.guaranteed < length && !this.drained) {
				const size = length - this.guaranteed;
				const readSize = Math.max(this._minReadingSize, size);
				await this.readMore(readSize);
			}
			return this._messages.slice(0, this._filled);
		} finally {
			await this.source.unblockNewMessages();
		}
	}

	async readMore(size: number) {
		try {
			await this.source.blockNewMessages();
			this._isReading = true;
			const availableNow = this.guaranteed;
			await this.criticalSection.enter();
			let reducedSize = size - (this.guaranteed - availableNow);
			if (reducedSize <= 0) {
				return this._messages.slice(0, this._filled);
			}
			if (this._paused) {
				throw new Error(`You can't read more from paused PuppetListSource. Please, resume it first`);
			}
			let read = 0;
			while (read < reducedSize && !this.drained) {
				const availableInCache = this._messages.length - this._filled;
				const canReadFromCache = Math.min(reducedSize, availableInCache);
				if (canReadFromCache > 0) {
					this._filled += canReadFromCache;
					reducedSize -= canReadFromCache;
					continue;
				}
				const wasSize = this._messages.length;
				const readSize = Math.max(this._minReadingSize, reducedSize - read);
				await this.source.readMore(readSize);
				const newSize = this._messages.length;
				read += newSize - wasSize;
			}
			return this._messages.slice(0, this._filled);
		} finally {
			this._isReading = false;
			await this.source.unblockNewMessages();
			await this.criticalSection.leave();
		}
	}
}
