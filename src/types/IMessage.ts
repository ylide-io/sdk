export interface IMessageBase {
	msgId: string;
	createdAt: number;
	senderAddress: string;
	recipientAddress: string;
	blockchain: string;

	key: Uint8Array;

	blockchainMeta: any;
	userspaceMeta: any;

	isContentDecrypted: boolean;
	decryptedContent: Uint8Array | null;

	isContentLoaded: boolean;
	contentLink: IMessageContent | null;
}

export enum MessageContentFailure {
	NOT_ALL_PARTS,
	NON_INTEGRITY_PARTS,
	DOUBLED_PARTS,
	NON_DECRYPTABLE,
	TIMING_FAILURE,
}

export interface IMessageCorruptedContent {
	msgId: string;
	corrupted: true;
	chunks: { createdAt: number }[];
	reason: MessageContentFailure;
}

export interface IMessageContent {
	msgId: string;
	corrupted: false;
	storage: string;
	createdAt: number;
	senderAddress: string;
	parts: number;
	content: Uint8Array;
}

export type IMessage = IMessageBase;

export interface RetrievingMessagesOptions {
	firstMessageIdToStopSearching?: string;
	since?: Date;
	to?: Date;
	messagesLimit?: number;
	nextPageAfterMessage?: IMessage;
}
