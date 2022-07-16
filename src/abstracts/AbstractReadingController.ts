import { IMessage, IMessageContent, IMessageCorruptedContent, RetrievingMessagesOptions } from '../types/IMessage';

export abstract class AbstractReadingController {
	constructor(options: any) {
		//
	}

	static blockchainType(): string {
		throw new Error(`Method not implemented`);
	}
	// address
	abstract isAddressValid(address: string): boolean;

	// message send block
	abstract getRecipientReadingRules(address: string): Promise<any>;

	// message history block
	abstract retrieveMessageHistoryByDates(
		recipientAddress: string,
		options?: RetrievingMessagesOptions,
	): Promise<IMessage[]>;
	abstract retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;
	abstract retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | IMessageCorruptedContent | null>;

	// keys block
	abstract extractPublicKeyFromAddress(address: string): Promise<Uint8Array | null>;
	abstract extractAddressFromPublicKey(publicKey: Uint8Array): Promise<string | null>;
}

export type AbstractReadingControllerClass = typeof AbstractReadingController;

export type AbstractReadingControllerConstructor = new (options: any) => AbstractReadingController;
