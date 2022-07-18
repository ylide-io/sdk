import { IMessage, IMessageContent, IMessageCorruptedContent, RetrievingMessagesOptions } from '../types/IMessage';

/**
 * @description It's an abstract class designated to define an interface to read messaging data from blockchain: messages metadata, content and public keys of recipients
 * @example Example of how to define your own ancestor:
 * ```ts
 * import { Ylide, AbstractReadingController } from '@ylide/sdk';
 *
 * class EverscaleReadingController extends AbstractReadingController {
 *     readonly registryContract: RegistryContract;
 *
 *     constructor(options: { dev?: boolean } = {}) {
 *         super(options);
 *
 *         // ...
 *     }
 *
 *     static blockchainType(): string {
 *         return "everscale";
 *     }
 *
 *     async extractAddressFromPublicKey(
 *         publicKey: Uint8Array
 *     ): Promise<string | null> {
 *         return this.registryContract.getAddressByPublicKey(publicKey);
 *     }
 *
 *     // Other implementations ...
 * }
 * ```
 */
export abstract class AbstractReadingController {
	constructor(options: any) {
		//
	}

	/**
	 * Static method to get the name of the blockchain this reading controller can work with
	 */
	static blockchainType(): string {
		throw new Error(`Method not implemented`);
	}

	/**
	 * Method to check address validity in this blockchain
	 */
	abstract isAddressValid(address: string): boolean;

	/**
	 * Method to retrieve recipient rules for getting messages
	 *
	 * @param address - Address of the wallet you want to retrieve rules of
	 */
	abstract getRecipientReadingRules(address: string): Promise<any>;

	/**
	 * Method to retrieve messages from this blockchain for a certain recipient
	 *
	 * @param recipientAddress - Address of the recipient
	 * @param options - Rules for filtering messages history
	 */
	abstract retrieveMessageHistoryByDates(
		recipientAddress: string,
		options?: RetrievingMessagesOptions,
	): Promise<IMessage[]>;

	/**
	 * Method to retrieve and verify integrity of the encrypted content of a certain message
	 *
	 * @param msg - Message metadata
	 */
	abstract retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;

	/**
	 * Method to retrieve the encrypted content of a certain message without deep integrity check
	 *
	 * @param msg - Message metadata
	 */
	abstract retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | IMessageCorruptedContent | null>;

	/**
	 * Method to get public key of the recipient by address. If key is not registered - you will get `null`.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract extractPublicKeyFromAddress(address: string): Promise<Uint8Array | null>;

	/**
	 * Method to get address of the recipient by public key. Used to verify integrity of the message. Returns `null` if address was not connected to this public key.
	 *
	 * @param publicKey - Public key of recipient
	 */
	abstract extractAddressFromPublicKey(publicKey: Uint8Array): Promise<string | null>;
}

export type AbstractReadingControllerClass = typeof AbstractReadingController;

export type AbstractReadingControllerConstructor = new (options: any) => AbstractReadingController;
