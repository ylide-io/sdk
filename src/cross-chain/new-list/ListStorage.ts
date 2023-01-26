import { DoublyLinkedListNode } from '@datastructures-js/linked-list';
import { BetterDoublyLinkedList } from '../types';
import { ListCache } from './ListCache';
import { AscComparator } from './types/AscComparator';

export type SegmentEndPosition<T> =
	| { type: 'after' }
	| { type: 'before'; segmentIdx: number }
	| { type: 'inside'; segmentIdx: number; element: DoublyLinkedListNode<T> };
export class ListStorage<T> {
	// descending order of segments, each segment is sorted descending too
	// guaranteed that there will be no empty segments
	readonly segments: BetterDoublyLinkedList<T>[] = [];

	constructor(public readonly comparator: AscComparator<T>, public readonly cache?: ListCache<T>) {
		//
	}

	private async _save() {
		if (this.cache) {
			await this.cache.save(this);
		}
	}

	async load() {
		if (this.cache) {
			await this.cache.load(this);
		}
	}

	private getPos(msg: T, since: SegmentEndPosition<T> | null = null): SegmentEndPosition<T> {
		if (since?.type === 'after') {
			return { type: 'after' };
		}
		for (let i = since?.segmentIdx || 0; i < this.segments.length; i++) {
			const segment = this.segments[i];
			const segmentFirst = segment.head();
			const segmentLast = segment.tail();
			const toFirst = this.comparator(msg, segmentFirst.getValue());
			const toLast = this.comparator(msg, segmentLast.getValue());
			if (toFirst > 0) {
				return {
					type: 'before',
					segmentIdx: i,
				};
			} else if (toFirst === 0) {
				return {
					type: 'inside',
					segmentIdx: i,
					element: segmentFirst,
				};
			} else {
				if (toLast < 0) {
					// element is after the last one, out of bounds
					continue;
				} else if (toLast === 0) {
					return {
						type: 'inside',
						segmentIdx: i,
						element: segmentLast,
					};
				} else {
					for (let current = segmentFirst; current !== null; current = current.getNext()) {
						const cmpr = this.comparator(msg, current.getValue());
						if (cmpr === 0) {
							return {
								type: 'inside',
								segmentIdx: i,
								element: current,
							};
						} else if (cmpr > 0) {
							throw new Error('Should never happen. Seems like list is not ordered correctly');
						}
					}
					throw new Error('Should never happen. Seems like list is not ordered correctly');
				}
			}
		}
		return { type: 'after' };
	}

	private _put(descSortedConnectedValues: T[]) {
		if (descSortedConnectedValues.length === 0) {
			// do nothing
		} else if (descSortedConnectedValues.length === 1) {
			const first = descSortedConnectedValues[0];
			const firstPos = this.getPos(first);
			if (firstPos.type === 'before') {
				const newSegment = new BetterDoublyLinkedList<T>();
				newSegment.insertFirst(first);
				this.segments.splice(firstPos.segmentIdx, 0, newSegment);
			} else if (firstPos.type === 'after') {
				const newSegment = new BetterDoublyLinkedList<T>();
				newSegment.insertFirst(first);
				this.segments.push(newSegment);
			} else {
				// do nothing, as the same element is already inside the list
				// inside
				// const insideSegment = this.segments[firstPos.segmentIdx];
				// insideSegment.insertBefore(first, firstPos.element);
			}
		} else {
			const first = descSortedConnectedValues[0];
			const last = descSortedConnectedValues[descSortedConnectedValues.length - 1];
			const firstPos = this.getPos(first);
			const lastPos = this.getPos(last);
			if (firstPos.type === 'after') {
				const newSegment = new BetterDoublyLinkedList<T>();
				let currentNode = null;
				for (const msg of descSortedConnectedValues) {
					if (currentNode === null) {
						currentNode = newSegment.insertFirst(msg);
					} else {
						currentNode = newSegment.insertAfter(msg, currentNode);
					}
				}
				this.segments.push(newSegment);
			} else if (firstPos.type === 'before') {
				if (lastPos.type === 'after') {
					const newSegment = new BetterDoublyLinkedList<T>();
					let currentNode = null;
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = newSegment.insertFirst(msg);
						} else {
							currentNode = newSegment.insertAfter(msg, currentNode);
						}
					}
					this.segments.splice(firstPos.segmentIdx, this.segments.length - firstPos.segmentIdx, newSegment);
				} else if (lastPos.type === 'before') {
					const newSegment = new BetterDoublyLinkedList<T>();
					let currentNode = null;
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = newSegment.insertFirst(msg);
						} else {
							currentNode = newSegment.insertAfter(msg, currentNode);
						}
					}
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx, newSegment);
				} else {
					// last inside...
					const newSegment = new BetterDoublyLinkedList<T>();
					// remove segments between first and last, including last
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx + 1, newSegment);
					let currentNode = null;
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = newSegment.insertFirst(msg);
						} else {
							currentNode = newSegment.insertAfter(msg, currentNode);
						}
					}
					for (let current = lastPos.element.getNext(); current !== null; current = current.getNext()) {
						currentNode = newSegment.insertAfter(current.getValue(), currentNode);
					}
				}
			} else {
				// first inside
				if (lastPos.type === 'after') {
					this.segments.splice(firstPos.segmentIdx + 1, this.segments.length - firstPos.segmentIdx - 1);
					const firstSegment = this.segments[firstPos.segmentIdx];
					let currentNode = firstPos.element.getPrev();
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = firstSegment.insertFirst(msg);
						} else {
							currentNode = firstSegment.insertAfter(msg, currentNode);
						}
					}
					// drop the tail of the firstSegment
					currentNode.setNext(null as any);
					firstSegment.setTail(currentNode);
				} else if (lastPos.type === 'before') {
					this.segments.splice(firstPos.segmentIdx + 1, lastPos.segmentIdx - firstPos.segmentIdx - 1);
					const firstSegment = this.segments[firstPos.segmentIdx];
					let currentNode = firstPos.element.getPrev();
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = firstSegment.insertFirst(msg);
						} else {
							currentNode = firstSegment.insertAfter(msg, currentNode);
						}
					}
					// drop the tail of the firstSegment
					currentNode.setNext(null as any);
					firstSegment.setTail(currentNode);
				} else {
					// lastPos is inside
					this.segments.splice(firstPos.segmentIdx + 1, lastPos.segmentIdx - firstPos.segmentIdx);
					// [0, 1, 2, 3, 4, 5]
					const firstSegment = this.segments[firstPos.segmentIdx];
					let currentNode = firstPos.element.getPrev();
					for (const msg of descSortedConnectedValues) {
						if (currentNode === null) {
							currentNode = firstSegment.insertFirst(msg);
						} else {
							currentNode = firstSegment.insertAfter(msg, currentNode);
						}
					}
					// drop the tail of the firstSegment
					currentNode.setNext(null as any);
					firstSegment.setTail(currentNode);
					for (let current = lastPos.element.getNext(); current !== null; current = current.getNext()) {
						currentNode = firstSegment.insertAfter(current.getValue(), currentNode);
					}
				}
			}
		}
	}

	async dropToCache() {
		await this._save();
	}

	async putObjects(descSortedConnectedValues: T[], dropToCache = true) {
		this._put(descSortedConnectedValues);
		if (dropToCache && descSortedConnectedValues.length) {
			await this._save();
		}
	}

	async putObjectsSegments(descSortedConnectedValuesSegments: T[][], dropToCache = true) {
		for (const descSortedConnectedValues of descSortedConnectedValuesSegments) {
			this._put(descSortedConnectedValues);
		}
		if (dropToCache) {
			await this._save();
		}
	}
}
