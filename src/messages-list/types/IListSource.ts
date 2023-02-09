import { DoublyLinkedList } from '@datastructures-js/linked-list';

import { AsyncEventEmitter } from '../../common';
import { IMessage } from '../../types';
import { IBlockchainSourceSubject } from './IBlockchainSourceSubject';

export interface IListSource extends AsyncEventEmitter {
	loadStorage(): Promise<void>;
	resume(): Promise<void>;
	pause(): void;

	blockNewMessages(): Promise<void>;
	unblockNewMessages(): Promise<void>;

	readUntil(length: number): Promise<void>;
	readMore(size: number): Promise<void>;
	compare(a: IMessage, b: IMessage): number;

	getName(): string;

	guaranteedSegment: DoublyLinkedList<IMessage> | null;
	paused: boolean;
	drained: boolean;
	guaranteed: number;
	subject: IBlockchainSourceSubject | null;
}
