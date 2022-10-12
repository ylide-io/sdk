import { EventEmitter } from 'eventemitter3';
import { AvlTree, DoublyLinkedListNode } from 'datastructures-js';
import { BetterDoublyLinkedList } from '../types/BetterDoublyLinkedList';
import { ExecutionQueue, ExecutionState, IExecutionFuture } from '../types/ExecutionQueue';

export interface GenericEntryPure<T> {
	time: number;
	link: T;
}

export interface GenericEntry<T, S extends GenericSortedSource<T>> extends GenericEntryPure<T> {
	source: S;
}

export interface GenericSortedSource<T> {
	compare: (a: GenericEntryPure<T>, b: GenericEntryPure<T>) => number;
	getBefore(entry: GenericEntryPure<T>, limit: number): Promise<GenericEntryPure<T>[]>;
	getLast(limit: number): Promise<GenericEntryPure<T>[]>;

	init(): Promise<void>;

	on(event: 'messages', callback: (params: { messages: GenericEntryPure<T>[] }) => void): void;
	on(event: 'message', callback: (params: { message: GenericEntryPure<T> }) => void): void;

	off(event: 'messages', callback: (params: { messages: GenericEntryPure<T>[] }) => void): void;
	off(event: 'message', callback: (params: { message: GenericEntryPure<T> }) => void): void;
}

export interface IFirstLastMessage<T, S extends GenericSortedSource<T>> {
	first: GenericEntry<T, S> | null;
	last: GenericEntry<T, S> | null;
}

export interface WrappedSource<T, S extends GenericSortedSource<T>> {
	source: S;
	handler: (params: { messages: GenericEntryPure<T>[] }) => void;
	array: GenericEntry<T, S>[]; // desc sorted
	firstLast: IFirstLastMessage<T, S>;
	firstLastWindow: IFirstLastMessage<T, S>;
	noMoreAvailable: boolean;
}

export type FilterFunction<T> = (entry: GenericEntryPure<T>) => boolean;

export interface IConfigurationManager<T, S extends GenericSortedSource<T>> {
	setFilter: (newFilter: FilterFunction<T> | null) => void;
	setPageSize: (newPageSize: number) => void;
	addSource: (source: S) => void;
	removeSource: (source: S) => void;
}

export interface IUpdateIndicator {
	wasGeneralWindowUpdated: boolean;
	wasFilteredWindowUpdated: boolean;
}

const emptyUpdate: () => IUpdateIndicator = () => ({
	wasGeneralWindowUpdated: false,
	wasFilteredWindowUpdated: false,
});

export class CombinedList<T, S extends GenericSortedSource<T>> extends EventEmitter {
	private sources: WrappedSource<T, S>[] = [];
	private sourceIndex: Map<S, number> = new Map();
	private msgs = new AvlTree<DoublyLinkedListNode<GenericEntry<T, S>>>((a, b) =>
		this.compare(a.getValue(), b.getValue()),
	);
	private list = new BetterDoublyLinkedList<GenericEntry<T, S>>();

	private queue = new ExecutionQueue(this.executeCommand.bind(this));

	private windowFirstMessage: DoublyLinkedListNode<GenericEntry<T, S>> | null = null;
	private windowLastMessage: DoublyLinkedListNode<GenericEntry<T, S>> | null = null;

	private pageSize: number = 10;

	private generalWindow: GenericEntry<T, S>[] = [];
	private filteredWindow: GenericEntry<T, S>[] = [];
	private filter: FilterFunction<T> | null = null;

	private async executeCommand(
		state: ExecutionState<
			| { type: 'first-page'; configurer: any }
			| { type: 'next-page' }
			| { type: 'new-messages'; messages: GenericEntry<T, S>[] }
		>,
	): Promise<IExecutionFuture<GenericEntry<T, S>[]>> {
		// debugger;
		if (state.request.type === 'first-page') {
			state.request.configurer({
				setFilter: this.setFilter.bind(this),
				setPageSize: this.setPageSize.bind(this),
				addSource: this.addSource.bind(this),
				removeSource: this.removeSource.bind(this),
			});

			await this.initSources();
			this.reinitiate(true);

			if (state.cancelled) {
				return {
					error: null,
					result: null,
					type: 'cancelled',
				};
			}

			while (!state.cancelled && this.filteredWindow.length < this.pageSize) {
				if (!(await this._goNextPage())) {
					break;
				}
			}

			if (state.cancelled) {
				return {
					error: null,
					result: null,
					type: 'cancelled',
				};
			}

			return {
				error: null,
				result: this.filteredWindow,
				type: 'success',
			};
		} else if (state.request.type === 'next-page') {
			const wasFilled = this.filteredWindow.length;
			let was = await this._goNextPage();
			while (!state.cancelled && was && this.filteredWindow.length - wasFilled < this.pageSize) {
				was = await this._goNextPage();
			}
			if (state.cancelled) {
				return {
					error: null,
					result: null,
					type: 'cancelled',
				};
			}
			return {
				error: null,
				result: this.filteredWindow,
				type: 'success',
			};
		} else {
			const updateState = emptyUpdate();
			for (const message of state.request.messages) {
				this.mergeUpdates(updateState, this.putMessage(message));
			}
			if (updateState.wasGeneralWindowUpdated) {
				this.handleWindowUpdated();
			}
			if (updateState.wasFilteredWindowUpdated) {
				this.emit('windowUpdate', this.filteredWindow);
			}
			return {
				error: null,
				result: this.filteredWindow,
				type: 'success',
			};
		}
	}

	public async configure(configurer: (manager: IConfigurationManager<T, S>) => void) {
		await this.queue.cancelAll();
		return this.queue.execute({ type: 'first-page', configurer }).promise;
	}

	private setFilter(newFilter: FilterFunction<T> | null) {
		this.filter = newFilter;
	}

	private setPageSize(newPageSize: number) {
		this.pageSize = newPageSize;
	}

	private is(entry: GenericEntryPure<T>) {
		return this.filter ? this.filter(entry) : true;
	}

	private compare(a: GenericEntry<T, S>, b: GenericEntry<T, S>): number {
		if (a.time === b.time) {
			const aSourceIdx = this.sourceIndex.get(a.source)!;
			const bSourceIdx = this.sourceIndex.get(b.source)!;
			if (aSourceIdx === bSourceIdx) {
				return a.source.compare(a, b);
			} else {
				return bSourceIdx - aSourceIdx;
			}
		} else {
			return b.time - a.time;
		}
	}

	private handleWindowUpdated() {
		const minmax: IFirstLastMessage<T, S>[] = this.sources.map(r => ({ first: null, last: null }));
		for (const m of this.generalWindow) {
			const sourceIdx = this.sourceIndex.get(m.source)!;
			if (!minmax[sourceIdx].first) {
				minmax[sourceIdx].first = m;
			}
			minmax[sourceIdx].last = m;
		}
		for (let r = 0; r < this.sources.length; r++) {
			const source = this.sources[r];
			// if (minmax[r].first) {
			source.firstLastWindow.first = minmax[r].first;
			source.firstLastWindow.last = minmax[r].last;
			// }
		}
	}

	private saveMessage(msg: GenericEntry<T, S>) {
		const node = new DoublyLinkedListNode(msg);

		const sourceIdx = this.sourceIndex.get(msg.source)!;
		const source = this.sources[sourceIdx];
		const first = source.array.at(0);
		const last = source.array.at(-1);
		const arr = source.array;

		if (!first || this.compare(msg, first) < 0) {
			arr.unshift(msg);
		} else if (!last || this.compare(msg, last) > 0) {
			arr.push(msg);
		} else {
			// console.error('Wtf');
			// debugger;
		}

		const willBeInsertedBeforeTreeNode = this.msgs.upperBound(node);
		const willBeInsertedBeforeListNode = willBeInsertedBeforeTreeNode?.getValue() || null;

		this.list.insertBeforeForNode(node, willBeInsertedBeforeListNode);
		this.msgs.insert(node);

		return node;
	}

	private putMessage(msg: GenericEntry<T, S>): IUpdateIndicator {
		const node = this.saveMessage(msg);
		let insertionType: 'before' | 'inside' | 'after';

		let wasGeneralWindowUpdated = false;
		let wasFilteredWindowUpdated = false;
		if (this.generalWindow.length === 0) {
			insertionType = 'inside';
			this.generalWindow.push(msg);
			this.windowFirstMessage = node;
			this.windowLastMessage = node;
			wasGeneralWindowUpdated = true;
			if (this.is(msg)) {
				this.filteredWindow.push(msg);
				wasFilteredWindowUpdated = true;
			}
		} else if (this.compare(msg, this.windowFirstMessage!.getValue()) < 0) {
			insertionType = 'before';
			this.generalWindow.unshift(msg);
			this.windowFirstMessage = node;
			wasGeneralWindowUpdated = true;
			if (this.is(msg)) {
				this.filteredWindow.unshift(msg);
				wasFilteredWindowUpdated = true;
			}
		} else if (this.compare(msg, this.windowLastMessage!.getValue()) <= 0) {
			insertionType = 'inside';
			this.generalWindow.splice(
				this.generalWindow.findIndex(v => this.compare(v, msg) >= 0),
				0,
				msg,
			);
			wasGeneralWindowUpdated = true;
			if (this.is(msg)) {
				this.filteredWindow.splice(
					this.filteredWindow.findIndex(v => this.compare(v, msg) >= 0),
					0,
					msg,
				);
				wasFilteredWindowUpdated = true;
			}
		} else {
			insertionType = 'after';
			this.generalWindow.push(msg);
			this.windowLastMessage = node;
			wasGeneralWindowUpdated = true;
			if (this.is(msg)) {
				this.filteredWindow.push(msg);
				wasFilteredWindowUpdated = true;
			}
		}

		return {
			wasGeneralWindowUpdated,
			wasFilteredWindowUpdated,
		};
	}

	private reinitiate(soft = false) {
		const arraysBackup = this.sources.map(s => s.array);

		this.sources.forEach(source => {
			if (!soft) {
				source.noMoreAvailable = false;
				source.array = [];
			}
			source.firstLastWindow = { first: null, last: null };
		});

		this.windowFirstMessage = null;
		this.windowLastMessage = null;
		this.generalWindow = [];
		this.filteredWindow = [];

		if (!soft) {
			this.msgs.clear();
			this.list.clear();

			for (const array of arraysBackup) {
				for (const msg of array) {
					this.saveMessage(msg);
				}
			}
		}
	}

	private mergeUpdates(a: IUpdateIndicator, b: IUpdateIndicator) {
		a.wasGeneralWindowUpdated ||= b.wasGeneralWindowUpdated;
		a.wasFilteredWindowUpdated ||= b.wasFilteredWindowUpdated;
	}

	private addSource(source: S) {
		const handler = ({ messages }: { messages: GenericEntryPure<T>[] }) => {
			this.queue.execute({ type: 'new-messages', messages: messages.reverse().map(m => ({ ...m, source })) });
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
	}

	private removeSource(source: S) {
		const idx = this.sourceIndex.get(source);
		if (idx === undefined) {
			return;
		}
		source.off('messages', this.sources[idx].handler);
		this.sources.splice(idx, 1);
		this.sourceIndex.clear();
		for (let i = 0; i < this.sources.length; i++) {
			this.sourceIndex.set(this.sources[i].source, i);
		}
	}

	private async initSources() {
		await Promise.all(this.sources.map(async source => source.source.init()));
	}

	private getOverlook(source: WrappedSource<T, S>, maxOverlook: number = 0) {
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
			if (maxOverlook && overlook >= maxOverlook) {
				return maxOverlook;
			}
		}
		return overlook;
	}

	private async readNextPage() {
		const notLoaded: WrappedSource<T, S>[] = [];
		for (const source of this.sources) {
			if (source.noMoreAvailable) {
				continue;
			}
			const overlook = this.getOverlook(source, this.pageSize);
			if (overlook < this.pageSize) {
				notLoaded.push(source);
			}
		}
		for (const source of notLoaded) {
			const lastMessage = source.array.at(-1);
			try {
				const newMessages = lastMessage
					? await source.source.getBefore(lastMessage, this.pageSize)
					: await source.source.getLast(this.pageSize);

				if (newMessages.length < this.pageSize) {
					source.noMoreAvailable = true;
				}

				for (const message of newMessages) {
					this.saveMessage({
						...message,
						source: source.source,
					});
				}
			} catch (err) {
				source.noMoreAvailable = true;
				// console.error('Error loading messages: ', err);
				// Do nothing
			}
		}
	}

	isNextPageAvailable() {
		return this.isNextPageAvailableInCache() || this.sources.some(s => !s.noMoreAvailable);
	}

	private isNextPageAvailableInCache() {
		if (!this.list.head()) {
			return false;
		}
		if (this.sources.every(s => s.noMoreAvailable)) {
			if (this.windowLastMessage) {
				return !!this.windowLastMessage.getNext();
			} else {
				return this.sources.some(s => s.array.length);
			}
		}
		for (const source of this.sources) {
			if (source.noMoreAvailable) {
				continue;
			}
			const overlook = this.getOverlook(source, this.pageSize);
			if (overlook < this.pageSize) {
				return false;
			}
		}
		return true;
	}

	private _processCurrentPage() {
		let cursor = this.windowLastMessage ? this.windowLastMessage!.getNext() : this.list.head();
		let was = false;
		let gWas = false;
		for (let i = 0; i < this.pageSize; i++) {
			if (!cursor) {
				break;
			}
			const msg = cursor.getValue();
			if (!this.windowFirstMessage) {
				this.windowFirstMessage = cursor;
			}
			this.generalWindow.push(msg);
			this.windowLastMessage = cursor;
			gWas = true;
			if (this.is(msg)) {
				this.filteredWindow.push(msg);
				was = true;
			}
			cursor = cursor?.getNext() || null;
		}
		if (gWas) {
			this.handleWindowUpdated();
		}
	}

	private async _goNextPage() {
		if (!this.isNextPageAvailable()) {
			return false;
		}
		if (!this.isNextPageAvailableInCache()) {
			await this.readNextPage();
		}
		if (!this.isNextPageAvailableInCache()) {
			// we read all sources to the end
			return false;
		}
		this._processCurrentPage();
		return true;
	}

	public async goNextPage() {
		return this.queue.execute({ type: 'next-page' }).promise;
	}
}
