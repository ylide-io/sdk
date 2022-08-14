import { EventEmitter } from 'eventemitter3';
import { AvlTree, DoublyLinkedListNode } from 'datastructures-js';
import { BetterDoublyLinkedList } from './BetterDoublyLinkedList';

export interface GenericEntryPure<T> {
	time: number;
	link: T;
}

export interface GenericEntry<T> extends GenericEntryPure<T> {
	source: GenericSortedSource<T>;
}

export interface GenericSortedSource<T> {
	cmpr: (a: GenericEntryPure<T>, b: GenericEntryPure<T>) => number;
	getBefore(entry: GenericEntryPure<T>, limit: number): Promise<GenericEntryPure<T>[]>;
	getAfter(entry: GenericEntryPure<T>, limit: number): Promise<GenericEntryPure<T>[]>;
	getLast(limit: number): Promise<GenericEntryPure<T>[]>;

	init(): Promise<void>;

	on(event: 'messages', callback: (params: { messages: GenericEntryPure<T>[] }) => void): void;
	on(event: 'message', callback: (params: { message: GenericEntryPure<T> }) => void): void;

	off(event: 'messages', callback: (params: { messages: GenericEntryPure<T>[] }) => void): void;
	off(event: 'message', callback: (params: { message: GenericEntryPure<T> }) => void): void;
}

export interface IFirstLastMessage<T> {
	first: GenericEntry<T> | null;
	last: GenericEntry<T> | null;
}

interface WrappedSource<T> {
	source: GenericSortedSource<T>;
	handler: (params: { messages: GenericEntryPure<T>[] }) => void;
	array: GenericEntry<T>[];
	firstLast: IFirstLastMessage<T>;
	firstLastWindow: IFirstLastMessage<T>;
	noMoreAvailable: boolean;
}

export class GenericSortedMergedList<T> extends EventEmitter {
	private sources: WrappedSource<T>[] = [];
	private sourceIndex: Map<GenericSortedSource<T>, number> = new Map();
	private msgs = new AvlTree<DoublyLinkedListNode<GenericEntry<T>>>((a, b) =>
		this.compare(a.getValue(), b.getValue()),
	);
	private list = new BetterDoublyLinkedList<GenericEntry<T>>();

	private windowFirstMessage: DoublyLinkedListNode<GenericEntry<T>> | null = null;
	private windowLastMessage: DoublyLinkedListNode<GenericEntry<T>> | null = null;

	private pageSize: number = 10;
	private windowStart: number = 0;
	private windowFilled: number = 0;

	private window: GenericEntry<T>[] = [];

	getWindow() {
		return this.window;
	}

	private compare(a: GenericEntry<T>, b: GenericEntry<T>): number {
		if (a.time === b.time) {
			const aSourceIdx = this.sourceIndex.get(a.source)!;
			const bSourceIdx = this.sourceIndex.get(b.source)!;
			if (aSourceIdx === bSourceIdx) {
				return a.source.cmpr(a, b);
			} else {
				return bSourceIdx - aSourceIdx;
			}
		} else {
			return b.time - a.time;
		}
	}

	private handleWindowUpdated() {
		const minmax: IFirstLastMessage<T>[] = this.sources.map(r => ({ first: null, last: null }));
		for (let i = 0; i < this.window.length; i++) {
			const m = this.window[i];
			const sourceIdx = this.sourceIndex.get(m.source)!;
			if (!minmax[sourceIdx].first) {
				minmax[sourceIdx].first = m;
			}
			minmax[sourceIdx].last = m;
		}
		for (let r = 0; r < this.sources.length; r++) {
			const source = this.sources[r];
			if (minmax[r].first) {
				source.firstLastWindow.first = minmax[r].first;
				source.firstLastWindow.last = minmax[r].last;
			}
		}
	}

	private putMessage(msg: GenericEntry<T>): boolean {
		const node = new DoublyLinkedListNode(msg);
		let was = false;
		if (this.windowFilled === 0) {
			this.window = [msg];
			this.windowFirstMessage = node;
			this.windowLastMessage = node;
			this.windowFilled = 1;
			was = true;
		} else if (this.compare(msg, this.windowFirstMessage!.getValue()) < 0) {
			if (this.windowStart === 0) {
				was = true;
				this.window.unshift(msg);
				this.windowFirstMessage = node;
				this.windowFilled++;
				if (this.windowFilled > this.pageSize) {
					this.window.splice(this.pageSize, this.window.length - this.pageSize);
					this.windowFilled = this.pageSize;
					this.windowLastMessage = this.windowLastMessage!.getPrev();
				}
			} else {
				this.emit('beforeWindowUpdate');
				this.windowStart++;
			}
		} else if (this.compare(msg, this.windowLastMessage!.getValue()) <= 0) {
			// put inside window
			was = true;
			const pos = this.window.findIndex(v => this.compare(v, msg) >= 0);
			this.window.splice(pos, 0, msg);
			this.windowFilled++;
			if (this.windowFilled > this.pageSize) {
				this.window.splice(this.pageSize, this.window.length - this.pageSize);
				this.windowFilled = this.pageSize;
				if (pos === this.window.length - 1) {
					this.windowLastMessage = node;
				} else {
					this.windowLastMessage = this.windowLastMessage!.getPrev();
				}
			}
		} else {
			// put after window
			if (this.windowFilled < this.pageSize) {
				was = true;
				this.window.push(msg);
				this.windowLastMessage = node;
				this.windowFilled++;
			} else {
				// put after window (overlook)
				this.emit('afterWindowUpdate');
			}
		}

		const sourceIdx = this.sourceIndex.get(msg.source)!;
		const source = this.sources[sourceIdx];
		const fl = source.firstLast;
		const arr = source.array;

		if (!fl.first || this.compare(msg, fl.first) < 0) {
			fl.first = msg;
			arr.unshift(msg);
			if (!fl.last || this.compare(msg, fl.last) > 0) {
				fl.last = msg;
			}
		} else if (!fl.last || this.compare(msg, fl.last) > 0) {
			fl.last = msg;
			arr.push(msg);
			if (!fl.first || this.compare(msg, fl.first) < 0) {
				fl.first = msg;
			}
		}

		const willBeInsertedBeforeTreeNode = this.msgs.upperBound(node);
		const willBeInsertedBeforeListNode = willBeInsertedBeforeTreeNode?.getValue() || null;

		this.list.insertBeforeForNode(node, willBeInsertedBeforeListNode);
		this.msgs.insert(node);

		return was;
	}

	private putMessages(messages: GenericEntry<T>[]): boolean {
		let was = false;
		for (const msg of messages) {
			was = this.putMessage(msg) || was;
		}
		return was;
	}

	private reinitiate() {
		const arraysBackup = this.sources.map(s => s.array);

		this.sources.forEach(source => {
			source.noMoreAvailable = false;
			source.firstLast = {
				first: null,
				last: null,
			};
			source.array = [];
		});

		this.windowFirstMessage = null;
		this.windowLastMessage = null;
		this.windowStart = 0;
		this.windowFilled = 0;
		this.window = [];

		let was = false;
		for (const array of arraysBackup) {
			was = this.putMessages(array) || was;
		}
		if (was) {
			this.handleWindowUpdated();
			this.emit('windowUpdate');
		}
	}

	addSource(source: GenericSortedSource<T>) {
		const handler = ({ messages }: { messages: GenericEntryPure<T>[] }) => {
			console.log('source sent messages: ', messages);
			const isWindowChanged = this.putMessages(messages.map(message => ({ ...message, source })));
			if (isWindowChanged) {
				this.handleWindowUpdated();
				this.emit('windowUpdate');
			}
		};

		const wrappedSource = {
			source,
			array: [],
			firstLast: { first: null, last: null },
			firstLastWindow: { first: null, last: null },
			handler,
			noMoreAvailable: false,
		};

		this.sourceIndex.set(source, this.sources.push(wrappedSource) - 1);

		source.on('messages', handler);
		this.reinitiate();
	}

	removeSource(source: GenericSortedSource<T>) {
		const idx = this.sourceIndex.get(source);
		if (!idx) {
			return;
		}
		this.sourceIndex.delete(source);
		this.sources.splice(idx, 1);
		source.off('messages', this.sources[idx].handler);

		this.reinitiate();
	}

	async readFirstPage() {
		if (this.windowFirstMessage) {
			return;
		}
		for (const source of this.sources) {
			await source.source.init();
		}
		// await this.readNextPage();
	}

	private getOverlook(source: WrappedSource<T>) {
		if (!source.firstLastWindow.last) {
			return source.array.length;
		}
		let overlook = 0;
		for (let i = source.array.length - 1; i >= 0; i--) {
			if (source.array[i] === source.firstLastWindow.last) {
				return overlook;
			} else {
				overlook++;
			}
		}
		return overlook;
	}

	private async readNextPage() {
		const notLoaded: WrappedSource<T>[] = [];
		for (let r = 0; r < this.sources.length; r++) {
			const source = this.sources[r];
			if (!this.windowLastMessage) {
				notLoaded.push(source);
				continue;
			}
			if (source.noMoreAvailable) {
				continue;
			}
			const overlook = this.getOverlook(source);
			if (overlook < this.pageSize) {
				notLoaded.push(source);
			}
		}
		let wasUpdate = false;
		for (const source of notLoaded) {
			const lastMessage = source.firstLast.last;
			const newMessages = lastMessage
				? await source.source.getAfter(lastMessage, this.pageSize)
				: await source.source.getLast(this.pageSize);
			if (!newMessages.length) {
				source.noMoreAvailable = true;
			} else {
				wasUpdate =
					this.putMessages(
						newMessages.map(message => ({
							...message,
							source: source.source,
						})),
					) || wasUpdate;
			}
		}
		if (wasUpdate) {
			this.handleWindowUpdated();
			this.emit('windowUpdate');
		}
	}

	isNextPageAvailable() {
		return this.isNextPageAvailableInCache() || this.sources.some(s => !s.noMoreAvailable);
	}

	private isNextPageAvailableInCache() {
		if (!this.windowLastMessage) {
			return false;
		}
		if (this.sources.some(s => s.noMoreAvailable)) {
			return !!this.windowLastMessage.getNext();
		}
		for (const source of this.sources) {
			if (source.noMoreAvailable) {
				continue;
			}
			const overlook = this.getOverlook(source);
			if (overlook < this.pageSize) {
				return false;
			}
		}
		return true;
	}

	isPreviousPageAvailable() {
		if (!this.windowFirstMessage) {
			return false;
		}
		return this.windowStart > 0;
	}

	async goPreviousPage() {
		const length = Math.min(this.pageSize, this.windowStart);
		this.windowStart -= length;
		let cursor = this.windowFirstMessage;
		for (let i = 0; i < length; i++) {
			cursor = cursor?.getPrev() || null;
		}
		if (!cursor) {
			throw new Error('Cursor must be available');
		}
		this.windowFirstMessage = cursor;
		const newWindow = [];
		let i;
		for (i = 0; i < Math.min(this.pageSize, this.list.count() - this.windowStart); i++) {
			if (!cursor) {
				break;
			}
			newWindow.push(cursor.getValue());
			this.windowLastMessage = cursor;
			cursor = cursor?.getNext() || null;
		}
		this.windowFilled = i;
		this.window = newWindow;
		this.handleWindowUpdated();
		this.emit('windowUpdate');
	}

	async goNextPage() {
		if (!this.isNextPageAvailable()) {
			return;
		}
		if (!this.isNextPageAvailableInCache()) {
			await this.readNextPage();
		}
		if (!this.isNextPageAvailable()) {
			return;
		}
		this.windowStart += this.pageSize;
		let cursor = this.windowLastMessage!.getNext();
		this.windowFirstMessage = cursor;
		const newWindow = [];
		let i;
		for (i = 0; i < Math.min(this.pageSize, this.list.count() - this.windowStart); i++) {
			if (!cursor) {
				break;
			}
			newWindow.push(cursor.getValue());
			this.windowLastMessage = cursor;
			cursor = cursor?.getNext() || null;
		}
		this.windowFilled = i;
		this.window = newWindow;
		this.handleWindowUpdated();
		this.emit('windowUpdate');
	}
}
