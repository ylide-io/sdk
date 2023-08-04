import type { Uint256 } from './Uint256';

/**
 * @category Content
 * @description Interface representing base message metadata and content
 */
export interface IMessage<M = any> {
	isBroadcast: boolean;
	feedId: Uint256;

	msgId: string;

	createdAt: number;
	senderAddress: string;
	recipientAddress: Uint256;
	blockchain: string;

	key: Uint8Array;

	readonly $$meta: M;
}

/**
 * @category Content
 * @description Enum for all types of errors for message content reading/decrypting/unpacking
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
 * @category Content
 * @description Interface representing failed content-reading result
 */
export interface IMessageCorruptedContent {
	msgId: string;
	corrupted: true;
	chunks: { createdAt: number }[];
	reason: MessageContentFailure;
}

/**
 * @category Content
 * @description Interface representing successful content-reading result
 */
export interface IMessageContent {
	msgId: string;
	corrupted: false;
	createdAt: number;
	storage: string;
	senderAddress: string;
	parts: number;
	content: Uint8Array;
}
