import { DoublyLinkedList, DoublyLinkedListNode } from 'datastructures-js';

export class BetterDoublyLinkedList<T> extends DoublyLinkedList<T> {
	setHead(newHead: DoublyLinkedListNode<T> | null) {
		// @ts-ignore
		this._head = newHead;
	}

	setTail(newTail: DoublyLinkedListNode<T> | null) {
		// @ts-ignore
		this._tail = newTail;
	}

	setCount(newCount: number) {
		// @ts-ignore
		this._count = newCount;
	}

	insertBeforeForNode(value: DoublyLinkedListNode<T>, node: DoublyLinkedListNode<T> | null): DoublyLinkedListNode<T> {
		if (node === null) {
			return this.insertLastForNode(value);
		}

		if (node === this.head()) {
			return this.insertFirstForNode(value);
		}

		value.setNext(node);
		value.setPrev(node.getPrev());

		value.getNext().setPrev(value);
		value.getPrev().setNext(value);

		this.setCount(this.count() + 1);

		return value;
	}

	insertFirstForNode(newNode: DoublyLinkedListNode<T>) {
		if (this.isEmpty()) {
			this.setHead(newNode);
			this.setTail(newNode);
		} else {
			this.head().setPrev(newNode);
			newNode.setNext(this.head());
			this.setHead(newNode);
		}
		this.setCount(this.count() + 1);
		return newNode;
	}

	/**
	 * Adds a node at the end of the list.
	 * @public
	 * @param {any} value
	 * @returns {DoublyLinkedListNode}
	 */
	insertLastForNode(newNode: DoublyLinkedListNode<T>) {
		if (this.isEmpty()) {
			this.setHead(newNode);
			this.setTail(newNode);
		} else {
			newNode.setPrev(this.tail());
			this.tail().setNext(newNode);
			this.setTail(newNode);
		}
		this.setCount(this.count() + 1);
		return newNode;
	}
}
