import { MessageContent } from '../content/MessageContent';
import { YlideUnencryptedKeyPair } from '../keystore/YlideUnencryptedKeyPair';
import { IGenericAccount } from '../types/IGenericAccount';

/**
 * @description It's an abstract class designated to define an interface to send messages through blockchain and publish public keys
 * @example Example of how to define your own ancestor:
 * ```ts
 * import { Ylide, AbstractSendingController } from '@ylide/sdk';
 *
 * class EverscaleSendingController extends AbstractSendingController {
 *     readonly registryContract: RegistryContract;
 *
 *     constructor(options: { dev?: boolean } = {}) {
 *         super(options);
 *
 *         // ...
 *     }
 *
 *     static isWalletAvailable(): Promise<boolean> {
 *     	return new ProviderRpcClient().hasProvider();
 *     }
 *
 *     static walletType(): string {
 *     	return 'everwallet';
 *     }
 *
 *     static blockchainType(): string {
 *     	return 'everscale';
 *     }
 *
 *     async attachPublicKey(publicKey: Uint8Array) {
 *     	const me = await this.getAuthenticatedAccount();
 *     	if (!me) {
 *     		throw new Error('Not authorized');
 *     	}
 *     	await this.reader.registryContract.attachPublicKey(me.address, publicKey);
 *     }
 *
 *     // Other implementations ...
 * }
 * ```
 */
export abstract class AbstractSendingController {
	constructor(options: any) {
		//
	}

	/**
	 * Static method to check if a certain wallet is installed in the user's browser
	 */
	static async isWalletAvailable(): Promise<boolean> {
		throw new Error(`Method not implemented`);
	}

	/**
	 * Static method to get the name of the wallet this sending controller can work with
	 */
	static walletType(): string {
		throw new Error(`Method not implemented`);
	}

	/**
	 * Static method to get the name of the blockchain this sending controller can work with
	 */
	static blockchainType(): string {
		throw new Error(`Method not implemented`);
	}

	/**
	 * Method to get account currently authenticated by the wallet for this app
	 */
	abstract getAuthenticatedAccount(): Promise<IGenericAccount | null>;

	/**
	 * Method to request wallet to authenticate some account for this app
	 */
	abstract requestAuthentication(): Promise<IGenericAccount | null>;

	/**
	 * Method to request wallet to revoke authenticaion of this app
	 */
	abstract disconnectAccount(): Promise<void>;

	/**
	 * Method used to create Ylide keypair: it gets signature from the wallet for a certain magicString (usually containing Ylide password)
	 * @param magicString - string which consists of some fixed part and dynamic part like Ylide password
	 */
	abstract deriveMessagingKeypair(magicString: string): Promise<Uint8Array>;

	/**
	 * Method to send message using Ylide Protocol.
	 *
	 * @param serviceCode - service code of an app used to send message. Used for analytics, could be left zero-filled.
	 * @param keypair - unencrypted (temporarily accessible) keypair used to encrypt message
	 * @param content - message content container
	 * @param recipients - array of recipients (address-public key pairs)
	 */
	abstract sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: { address: string; publicKey: Uint8Array }[],
	): Promise<string | null>;

	/**
	 * Method to connect user's public key with his address
	 *
	 * @param publicKey - public key to attach to user's address
	 */
	abstract attachPublicKey(publicKey: Uint8Array): Promise<void>;
}

export type AbstractSendingControllerClass = typeof AbstractSendingController;

export type AbstractSendingControllerConstructor = new (options: any) => AbstractSendingController;
