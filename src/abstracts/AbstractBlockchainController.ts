import type { AbstractNameService } from './AbstractNameService';
import type {
	MessageKey,
	IExtraEncryptionStrateryBulk,
	IExtraEncryptionStrateryEntry,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	ISourceSubject,
	IBlockchainSourceSubject,
} from '..';
import type { LowLevelMessagesSource } from '../messages-list/types/LowLevelMessagesSource';
import type { RemotePublicKey } from '../keystore/RemotePublicKey';
import type { Uint256 } from '../primitives/Uint256';

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
	/**
	 * Method to get blockchain name
	 */
	abstract blockchain(): string;

	/**
	 * Method to get blockchain group name
	 *
	 * @description Blockchain group is a name of the group of blockchains which are compatible with each other
	 */
	abstract blockchainGroup(): string;

	/**
	 * Method to init controller. Must be called once before any other method.
	 * Automatically called when you instantiate using Ylide signleton.
	 */
	abstract init(): Promise<void>;

	/**
	 * Method to get instance of the default name service for this blockchain (if not available - returns null)
	 */
	abstract defaultNameService(): AbstractNameService | null;

	/**
	 * Method to get whether reading by individual sender is possible or not
	 */
	abstract isReadingBySenderAvailable(): boolean;

	/**
	 * Method to check address validity in this blockchain
	 */
	abstract isAddressValid(address: string): boolean;

	/**
	 * Method to convert address to 32 bytes lowercase hex string without prefix (widely used in SDK)
	 */
	abstract addressToUint256(address: string): Uint256;

	/**
	 * Method to check if this msgId is valid for this blockchain controller
	 *
	 * @param msgId - Msg ID to check
	 * @return `true` if msgId is valid for this blockchain
	 */
	abstract isValidMsgId(msgId: string): boolean;

	/**
	 * Method to get message by msgId
	 *
	 * @param msgId - Msg ID to check
	 */
	abstract getMessageByMsgId(msgId: string): Promise<IMessage | null>;

	/**
	 * Method to retrieve recipient rules for getting messages
	 *
	 * @param recipient - Address of the wallet you want to retrieve rules of
	 */
	abstract getRecipientReadingRules(recipient: Uint256): Promise<any>;

	/**
	 * Method to get wide list of subjects for which you will get messages from this blockchain
	 * It is intended to be used via ListMultiplexer, not for manual usage
	 *
	 * @param subject Description of a filtering criteria for the messages
	 */
	abstract getBlockchainSourceSubjects(subject: ISourceSubject): IBlockchainSourceSubject[];

	/**
	 * Method to instantiate messages source for a certain filtering criteria
	 *
	 * @param subject Description of a filtering criteria for the messages
	 */
	abstract ininiateMessagesSource(subject: IBlockchainSourceSubject): LowLevelMessagesSource;

	/**
	 * Method to retrieve the content of a certain message from blockchain
	 *
	 * @param msg - Message to retrieve content of
	 */
	abstract retrieveMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;

	/**
	 * Method to get public key of the recipient by address. If key is not registered - you will get `null`.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract extractPublicKeyFromAddress(address: string): Promise<RemotePublicKey | null>;

	/**
	 * Method to get public keys history of the certain address.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract extractPublicKeysHistoryByAddress(address: string): Promise<RemotePublicKey[]>;

	/**
	 * Method to get balance of the address. Currency used is the same which is used to pay for the Ylide tx in this blockchain.
	 * Usually it is the smallest native currency (e.g. wei in Ethereum)
	 *
	 * @param address - Recipient's wallet address
	 * @return Decimal number in a string format
	 */
	abstract getBalance(address: string): Promise<{ original: string; numeric: number; e18: string }>;

	/**
	 * Method to get instantiate non-Ylide encryption strategies for the address.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract getExtraEncryptionStrategiesFromAddress(address: string): Promise<IExtraEncryptionStrateryEntry[]>;

	/**
	 * Method to get available non-Ylide encryption strategies for the address.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract getSupportedExtraEncryptionStrategies(): string[];

	/**
	 * Method to combine non-Ylide encryption strategies to be sent to the recipient.
	 * It is intended to be used via DynamicEncryptionRouter (or even just YlideCore), not for manual usage
	 *
	 * @param entries - Entries to process
	 * @return Bulk to be sent to the recipient
	 */
	abstract prepareExtraEncryptionStrategyBulk(
		entries: IExtraEncryptionStrateryEntry[],
	): Promise<IExtraEncryptionStrateryBulk>;

	/**
	 * Method to get execute non-Ylide encryption strategies for address - actually encrypt the message key.
	 * It is intended to be used via DynamicEncryptionRouter (or even just YlideCore), not for manual usage
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract executeExtraEncryptionStrategy(
		entries: IExtraEncryptionStrateryEntry[],
		bulk: IExtraEncryptionStrateryBulk,
		addedPublicKeyIndex: number | null,
		messageKey: Uint8Array,
	): Promise<MessageKey[]>;

	/**
	 * Method to compare messages by time. Sometimes two messages could have the same time,
	 * so we need to sort them using some internal properties (e.g. blockNumber/logicalTime/etc).
	 *
	 * @param a - First message to compare
	 * @param b - Second message to compare
	 * @return -1 if a < b, 0 if a == b, 1 if a > b
	 * @description This method is used to sort messages in the list
	 */
	abstract compareMessagesTime(a: IMessage, b: IMessage): number;
}
