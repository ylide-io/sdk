import { AvlTree } from '@datastructures-js/binary-search-tree';
import { DoublyLinkedListNode } from '@datastructures-js/linked-list';
import { BetterDoublyLinkedList } from './BetterDoublyLinkedList';

export class SortedUniqueList<T> {
	private list: BetterDoublyLinkedList<T> = new BetterDoublyLinkedList();
	private map: Map<string, DoublyLinkedListNode<T>> = new Map();
	private tree: AvlTree<DoublyLinkedListNode<T>>;

	constructor(private comparator: (a: T, b: T) => number, private hash: (a: T) => string) {
		this.tree = new AvlTree<DoublyLinkedListNode<T>>((a, b) => this.comparator(a.getValue(), b.getValue()));
	}

	insert(...args: T[]) {
		for (const arg of args) {
			const hash = this.hash(arg);
			if (this.map.has(hash)) {
				continue;
			}
			const node = new DoublyLinkedListNode(arg);

			const willBeInsertedBeforeTreeNode = this.tree.upperBound(node);
			const willBeInsertedBeforeListNode = willBeInsertedBeforeTreeNode?.getValue() || null;

			this.list.insertBeforeForNode(node, willBeInsertedBeforeListNode);
			this.tree.insert(node);
		}
	}

	since(a: T | null, count: number) {
		const res: T[] = [];
		let node = a === null ? this.list.head() : this.map.get(this.hash(a));
		let got = 0;
		while (node && got < count) {
			res.push(node.getValue());
			node = node.getNext();
			got++;
		}
	}

	before(a: T | null, count: number) {
		const res: T[] = [];
		let node = a === null ? this.list.head() : this.map.get(this.hash(a));
		if (node) {
			node = node.getPrev();
		}
		let got = 0;
		while (node && got < count) {
			res.push(node.getValue());
			node = node.getPrev();
			got++;
		}
	}
}
