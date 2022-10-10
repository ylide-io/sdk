export class CriticalSection {
	private _busy = false;
	private _queue: (() => void)[] = [];

	constructor() {
		this._busy = false;
		this._queue = [];
	}

	enter() {
		return new Promise<void>(resolve => {
			this._queue.push(resolve);

			if (!this._busy) {
				this._busy = true;
				this._queue.shift()!();
			}
		});
	}

	leave() {
		if (this._queue.length) {
			this._queue.shift()!();
		} else {
			this._busy = false;
		}
	}
}
