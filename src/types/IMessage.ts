/**
 * Interface representing base message metadata and content
 */
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

/**
 * Enum for all types of errors for message content reading/decrypting/unpacking
 */
export enum MessageContentFailure {
	/**
	 * Not all parts of the message content were retrieved
	 */
	NOT_ALL_PARTS,

	/**
	 * Some parts were not found
	 */
	NON_INTEGRITY_PARTS,

	/**
	 * Some parts occured more than once
	 */
	DOUBLED_PARTS,

	/**
	 * Decryption of the message content was unsuccessful
	 */
	NON_DECRYPTABLE,

	/**
	 * Some parts of the message content were uploaded with a huge lag which may violate message's integrity
	 */
	TIMING_FAILURE,
}

/**
 * Interface representing failed content-reading result
 */
export interface IMessageCorruptedContent {
	msgId: string;
	corrupted: true;
	chunks: { createdAt: number }[];
	reason: MessageContentFailure;
}

/**
 * Interface representing successful content-reading result
 */
export interface IMessageContent {
	msgId: string;
	corrupted: false;
	storage: string;
	createdAt: number;
	senderAddress: string;
	parts: number;
	content: Uint8Array;
}

/**
 * Type representing a certain message
 */
export type IMessage = IMessageBase;

/**
 * Interface for filtering messages history on retrieval
 */
export interface RetrievingMessagesOptions {
	firstMessageIdToStopSearching?: string;
	since?: Date;
	to?: Date;
	messagesLimit?: number;
	nextPageAfterMessage?: IMessage;
}
