import { IMessage } from '../../types';
import { AscComparator } from './AscComparator';

export interface LowLevelMessagesSource {
	compare: AscComparator<IMessage>;

	getBefore(entry: IMessage, limit: number): Promise<IMessage[]>;
	getLast(limit: number, upToIncluding?: IMessage, mutableParams?: any): Promise<IMessage[]>;
	getAfter(entry: IMessage, limit: number): Promise<IMessage[]>;

	getName(): string;

	startTrackingNewMessages(
		subscriptionName: string,
		callback: (params: { messages: IMessage[]; afterMsgId: string | undefined }) => void,
	): () => void;
}
