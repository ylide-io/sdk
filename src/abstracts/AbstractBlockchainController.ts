import {
	MessageKey,
	PublicKey,
	IExtraEncryptionStrateryBulk,
	IExtraEncryptionStrateryEntry,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	RetrievingMessagesOptions,
} from '..';

/**
 * @description It's an abstract class designated to define an interface to read messaging data from blockchain: messages metadata, content and public keys of recipients
 * @example Example of how to define your own ancestor:
 * ```ts
 * import { Ylide, AbstractBlockchainController } from '@ylide/sdk';
 *
 * class EverscaleBlockchainController extends AbstractBlockchainController {
 *     readonly registryContract: RegistryContract;
 *
 *     constructor(options: { dev?: boolean } = {}) {
 *         super(options);
 *
 *         // ...
 *     }
 *
 *     async extractAddressFromPublicKey(
 *         publicKey: PublicKey
 *     ): Promise<string | null> {
 *         return this.registryContract.getAddressByPublicKey(publicKey.bytes);
 *     }
 *
 *     // Other implementations ...
 * }
 * ```
 */
export abstract class AbstractBlockchainController {
	constructor(options?: any) {
		//
	}

	/**
	 * Method to check address validity in this blockchain
	 */
	abstract isAddressValid(address: string): boolean;

	/**
	 * Method to make address from 32 bytes array
	 */
	abstract uint256ToAddress(value: Uint8Array): string;

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
	abstract extractPublicKeyFromAddress(address: string): Promise<PublicKey | null>;

	/**
	 * Method to get address of the recipient by public key. Used to verify integrity of the message. Returns `null` if address was not connected to this public key.
	 *
	 * @param publicKey - Public key of recipient
	 */
	abstract extractAddressFromPublicKey(publicKey: PublicKey): Promise<string | null>;

	/**
	 * Method to get available non-Ylide encryption strategies for address
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract getExtraEncryptionStrategiesFromAddress(address: string): Promise<IExtraEncryptionStrateryEntry[]>;

	/**
	 * Method to get available non-Ylide encryption strategies for address
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract getSupportedExtraEncryptionStrategies(): string[];

	abstract prepareExtraEncryptionStrategyBulk(
		entries: IExtraEncryptionStrateryEntry[],
	): Promise<IExtraEncryptionStrateryBulk>;

	/**
	 * Method to get available non-Ylide encryption strategies for address
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract executeExtraEncryptionStrategy(
		entries: IExtraEncryptionStrateryEntry[],
		bulk: IExtraEncryptionStrateryBulk,
		addedPublicKeyIndex: number | null,
		messageKey: Uint8Array,
	): Promise<MessageKey[]>;
}
