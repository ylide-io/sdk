import { DoublyLinkedList } from '@datastructures-js/linked-list';

import { AsyncEventEmitter } from '../../common';
import { IMessage } from '../../types';
import { IBlockchainSourceSubject } from './IBlockchainSourceSubject';

export interface IListSource extends AsyncEventEmitter {
	getName(): string;
	compare(a: IMessage, b: IMessage): number;

	readToBottom: boolean;
	guaranteedSegment: DoublyLinkedList<IMessage> | null;
	subject: IBlockchainSourceSubject;

	connect(
		subscriptionName: string,
		newMessagesCallback: () => void,
	): Promise<{
		request: (from: IMessage, limit?: number) => Promise<void>;
		dispose: () => void;
	}>;
}
