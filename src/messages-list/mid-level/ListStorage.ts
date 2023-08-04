import { ExtendedDoublyLinkedList } from '../../common';
import { validateDesc } from '../../utils/validateDesc';
import { YlideError, YlideErrorType } from '../../errors';

import { DoublyLinkedListNode } from '@datastructures-js/linked-list';

import type { ListCache } from './ListCache';
import type { AscComparator } from '../types';

export type SegmentEndPosition<T> =
	| { type: 'after' }
	| { type: 'before'; segmentIdx: number }
	| { type: 'inside'; segmentIdx: number; element: DoublyLinkedListNode<T> };

export class ListStorage<T> {
	// descending order of segments, each segment is sorted descending too
	// guaranteed that there will be no empty segments
	readonly segments: ExtendedDoublyLinkedList<T>[] = [];
	readToBottom = false;

	constructor(
		private name: string,
		public readonly comparator: AscComparator<T>,
		public readonly cache?: ListCache<T>,
	) {
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
							throw new YlideError(
								YlideErrorType.MUST_NEVER_HAPPEN,
								'Should never happen. Seems like list is not ordered correctly',
							);
						}
					}
					throw new YlideError(
						YlideErrorType.MUST_NEVER_HAPPEN,
						'Should never happen. Seems like list is not ordered correctly',
					);
				}
			}
		}
		return { type: 'after' };
	}

	private log(...args: any[]) {
		// console.log('LSt: ', ...args);
	}

	private toSegment(arr: T[]) {
		const segment = new ExtendedDoublyLinkedList<T>();
		for (const msg of arr) {
			segment.insertLast(msg);
		}
		return segment;
	}

	private toComplexSegment(arr: T[], sourceSegments: ExtendedDoublyLinkedList<T>[]) {
		const elements: DoublyLinkedListNode<T>[] = [];
		for (const msg of arr) {
			let found = null;
			for (const sourceSegment of sourceSegments) {
				const foundNode = sourceSegment.find(n => this.comparator(msg, n.getValue()) === 0);
				if (foundNode) {
					found = foundNode;
					break;
				}
			}
			if (found) {
				elements.push(found);
			} else {
				elements.push(new DoublyLinkedListNode(msg));
			}
		}
		const segment = new ExtendedDoublyLinkedList<T>();
		let i = 0;
		for (const node of elements) {
			if (i === 0) {
				node.setNext(null as any);
			} else {
				elements[i - 1].setNext(node);
				node.setPrev(elements[i - 1]);
			}
			i++;
		}
		let first = elements[0];
		while (first.getPrev()) {
			first = first.getPrev();
		}
		let count = 0;
		for (let current = first; current !== null; current = current.getNext()) {
			if (current === first) {
				segment.setHead(current);
			}
			segment.setTail(current);
			count++;
		}
		segment.setCount(count);
		return segment;
	}

	private _put(descSortedConnectedValues: T[]) {
		this.log('put', descSortedConnectedValues);
		if (descSortedConnectedValues.length === 0) {
			// do nothing
			this.log('put: nothing to put');
		} else if (descSortedConnectedValues.length === 1) {
			this.log('put: one element');
			const first = descSortedConnectedValues[0];
			const firstPos = this.getPos(first);
			if (firstPos.type === 'before') {
				this.segments.splice(firstPos.segmentIdx, 0, this.toSegment(descSortedConnectedValues));
			} else if (firstPos.type === 'after') {
				this.segments.push(this.toSegment(descSortedConnectedValues));
			} else {
				// do nothing, as the same element is already inside the list
			}
		} else {
			this.log('put: multiple elements');
			const first = descSortedConnectedValues[0];
			const last = descSortedConnectedValues[descSortedConnectedValues.length - 1];
			const firstPos = this.getPos(first);
			const lastPos = this.getPos(last);
			if (firstPos.type === 'after') {
				this.log('put: after');
				this.segments.push(this.toSegment(descSortedConnectedValues));
			} else if (firstPos.type === 'before') {
				this.log('put: before');
				if (lastPos.type === 'after') {
					this.log('put: before after');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx),
					);
					this.segments.splice(firstPos.segmentIdx, this.segments.length, newSegment);
				} else if (lastPos.type === 'before') {
					this.log('put: before before');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx, lastPos.segmentIdx),
					);
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx, newSegment);
				} else {
					this.log('put: before inside');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx, lastPos.segmentIdx + 1),
					);
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx + 1, newSegment);
				}
			} else {
				this.log('put: inside');
				// first inside
				if (lastPos.type === 'after') {
					this.log('put: inside after');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx),
					);
					this.segments.splice(firstPos.segmentIdx, this.segments.length, newSegment);
				} else if (lastPos.type === 'before') {
					this.log('put: inside before');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx, lastPos.segmentIdx),
					);
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx, newSegment);
				} else {
					this.log('put: inside inside');
					const newSegment = this.toComplexSegment(
						descSortedConnectedValues,
						this.segments.slice(firstPos.segmentIdx, lastPos.segmentIdx + 1),
					);
					this.segments.splice(firstPos.segmentIdx, lastPos.segmentIdx - firstPos.segmentIdx + 1, newSegment);
				}
			}
		}
	}

	async dropToCache() {
		await this._save();
	}

	private validateDesc(vals: T[]) {
		return validateDesc(this.name, vals, this.comparator);
	}

	async putObjects(descSortedConnectedValues: T[], dropToCache = true) {
		this.validateDesc(descSortedConnectedValues);
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
