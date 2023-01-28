import { IMessage } from '../../types';
import { AscComparator } from './AscComparator';

export interface LowLevelMessagesSource {
	compare: AscComparator<IMessage>;

	getBefore(entry: IMessage, limit: number): Promise<IMessage[]>;
	getLast(limit: number, upToIncluding?: IMessage, mutableParams?: any): Promise<IMessage[]>;
	getAfter(entry: IMessage, limit: number): Promise<IMessage[]>;

	resume(since?: IMessage): void;
	pause(): void;

	meta: any;

	on(event: 'messages', callback: (params: { meta: any; messages: IMessage[] }) => void): void;
	off(event: 'messages', callback: (params: { meta: any; messages: IMessage[] }) => void): void;
}
