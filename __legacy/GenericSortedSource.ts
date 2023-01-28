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
