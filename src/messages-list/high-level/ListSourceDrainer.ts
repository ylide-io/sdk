import { AsyncEventEmitter, CriticalSection } from '../../common';
import { IMessageWithSource, ListSourceMultiplexer } from './ListSourceMultiplexer';

export class ListSourceDrainer extends AsyncEventEmitter {
	private criticalSection = new CriticalSection();
	private _messages: IMessageWithSource[] = [];
	private _filled = 0;
	private _isReading = false;
	private _paused = true;
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
			const was = this._messages.slice();
			this._messages = this.source.guaranteedSegment.filter(this.filter);
			if (!this._isReading) {
				this._filled += this._messages.length - beforeSize;
				void this.emit('messages', { messages: this.messages.slice() }, false);
			}
		}
	};

	resetFilter(newFilter: null | ((m: IMessageWithSource) => void)) {
		this._filter = newFilter;
		this._filled = 0;
		this._messages = [];
		if (this.source.guaranteedSegment) {
			this._messages = this.source.guaranteedSegment.filter(this.filter);
		}
	}

	async resume() {
		if (!this.source.has('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated)) {
			this.source.on('guaranteedSegmentUpdated', this.handleSourceGuaranteedSegmentUpdated);
		}
		this._paused = false;
		this._isReading = true;
		await this.source.resume();
		this._isReading = false;
	}

	get messages() {
		return this._messages.slice(0, this._filled);
	}

	pause() {
		this._paused = true;
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

	private log(...args: any[]) {
		// console.log('LSD: ', ...args);
	}

	async readMore(size: number) {
		try {
			this.log('readMore 1');
			await this.source.blockNewMessages();
			this.log('readMore 2');
			this._isReading = true;
			const availableNow = this.guaranteed;
			await this.criticalSection.enter();
			this.log('readMore 3: availableNow: ', availableNow, ' guaranteed: ', this.guaranteed);
			let reducedSize = size - (this.guaranteed - availableNow);
			if (reducedSize <= 0) {
				this.log(
					'readMore 4: ',
					this._messages.slice(0, this._filled).map(r => r.msg.createdAt),
				);
				return this._messages.slice(0, this._filled);
			}
			if (this._paused) {
				throw new Error(`You can't read more from paused ListSourceDrainer. Please, resume it first`);
			}
			this.log('readMore 5');
			let read = 0;
			while (read < reducedSize && !this.drained) {
				const availableInCache = this._messages.length - this._filled;
				const canReadFromCache = Math.min(reducedSize, availableInCache);
				this.log('readMore 6', availableInCache, canReadFromCache);
				if (canReadFromCache > 0) {
					this._filled += canReadFromCache;
					reducedSize -= canReadFromCache;
					continue;
				}
				const wasSize = this._messages.length;
				const readSize = Math.max(this._minReadingSize, reducedSize - read);
				this.log('readMore 7: ', wasSize, readSize);
				await this.source.readMore(readSize);
				const newSize = this._messages.length;
				if (newSize - wasSize > reducedSize - read) {
					this._filled += reducedSize - read;
				} else {
					this._filled += newSize - wasSize;
				}
				read += newSize - wasSize;
				this.log('readMore 8: ', newSize, read);
			}
			this.log(
				'readMore 9: ',
				this._messages.slice(0, this._filled).map(r => r.msg.createdAt),
			);
			return this._messages.slice(0, this._filled);
		} finally {
			this.log('readMore 10');
			this._isReading = false;
			await this.source.unblockNewMessages();
			this.log('readMore 11');
			this.criticalSection.leave();
			this.log('readMore 12');
		}
	}
}
