import {
	MessageKey,
	IExtraEncryptionStrateryBulk,
	IExtraEncryptionStrateryEntry,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
} from '..';
import { ExternalYlidePublicKey } from '../types/ExternalPublicKey';
import { Uint256 } from '../types/Uint256';
import { AbstractNameService } from './AbstractNameService';

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
	abstract blockchain(): string;
	abstract blockchainGroup(): string;

	abstract init(): Promise<void>;

	/**
	 * Method to get instance of default name service for this blockchain (if available)
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
	 * Method to convert address to 32 bytes array
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
	 * @param msgId - Push ID to check
	 */
	abstract getMessageByPushId(msgId: string): Promise<IMessage | null>;

	/**
	 * Method to retrieve recipient rules for getting messages
	 *
	 * @param recipient - Address of the wallet you want to retrieve rules of
	 */
	abstract getRecipientReadingRules(recipient: Uint256): Promise<any>;

	// /**
	//  * Method to retrieve sent messages from this blockchain for a certain recipient
	//  *
	//  * @param recipient - Address of the recipient
	//  * @param fromTimestamp - Start time (not included) for filtering messages history
	//  * @param toTimestamp - End time (included) for filtering messages history
	//  */
	// abstract retrieveMessageHistoryDescByTime(
	// 	sender: Uint256 | null,
	// 	recipient: Uint256 | null,
	// 	fromTimestamp?: number,
	// 	toTimestamp?: number,
	// 	limit?: number,
	// ): Promise<IMessage[]>;

	/**
	 * Method to retrieve sent messages from this blockchain for a certain recipient
	 *
	 * @param recipient - Address of the recipient
	 * @param fromMessage - Start message (not included) for filtering messages history
	 * @param toMessage - End message (not included) for filtering messages history
	 */
	abstract retrieveMessageHistoryDesc(
		sender: string | null,
		recipient: Uint256 | null,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]>;

	// /**
	//  * Method to retrieve broadcasted messages from this blockchain of a certain sender
	//  *
	//  * @param sender - Address of the sender
	//  * @param fromTimestamp - Start time (not included) for filtering messages history
	//  * @param toTimestamp - End time (included) for filtering messages history
	//  */
	// abstract retrieveBroadcastHistoryDescByTime(
	// 	sender: string | null,
	// 	fromTimestamp?: number,
	// 	toTimestamp?: number,
	// 	limit?: number,
	// ): Promise<IMessage[]>;

	/**
	 * Method to retrieve broadcasted messages from this blockchain of a certain sender
	 *
	 * @param sender - Address of the sender
	 * @param fromMessage - Start message (not included) for filtering messages history
	 * @param toMessage - End message (not included) for filtering messages history
	 */
	abstract retrieveBroadcastHistoryDesc(
		sender: string | null,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]>;

	// /**
	//  * Method to retrieve and verify integrity of the encrypted content of a certain message
	//  *
	//  * @param msg - Message metadata
	//  */
	// abstract retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;

	/**
	 * Method to retrieve and verify the encrypted content of a certain message without deep integrity check
	 *
	 * @param msg - Message to retrieve content of
	 */
	abstract retrieveMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;

	/**
	 * Method to get public key of the recipient by address. If key is not registered - you will get `null`.
	 *
	 * @param address - Recipient's wallet address
	 */
	abstract extractPublicKeyFromAddress(address: string): Promise<ExternalYlidePublicKey | null>;

	/**
	 * Method to get balance of the address. Currency used is the same which is used to pay for the Ylide tx in this blockchain
	 *
	 * @param address - Recipient's wallet address
	 * @return Decimal number in a string format
	 */
	abstract getBalance(address: string): Promise<{ original: string; numeric: number; e18: string }>;

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

	abstract compareMessagesTime(a: IMessage, b: IMessage): number;
}
