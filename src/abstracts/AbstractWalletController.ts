import { MessageKey, AbstractBlockchainController, PublicKey, IGenericAccount } from '..';
import { Uint256 } from '../types/Uint256';

/**
 * @description It's an abstract class designated to define an interface to send messages through blockchain and publish public keys
 * @example Example of how to define your own ancestor:
 * ```ts
 * import { Ylide, AbstractWalletController } from '@ylide/sdk';
 *
 * class EverscaleWalletController extends AbstractWalletController {
 *     readonly registryContract: RegistryContract;
 *
 *     constructor(options: { dev?: boolean } = {}) {
 *         super(options);
 *
 *         // ...
 *     }
 *
 *     async attachPublicKey(publicKey: Uint8Array) {
 *     	const me = await this.getAuthenticatedAccount();
 *     	if (!me) {
 *     		throw new Error('Not authorized');
 *     	}
 *     	await this.blockchainController.registryContract.attachPublicKey(me.address, publicKey);
 *     }
 *
 *     // Other implementations ...
 * }
 * ```
 */
export abstract class AbstractWalletController {
	constructor(public readonly blockchainController: AbstractBlockchainController, options?: any) {
		//
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
	abstract signMagicString(magicString: string): Promise<Uint8Array>;

	/**
	 * Method to publish message using Ylide Protocol.
	 *
	 * @param contentData - raw bytes content to publish
	 * @param recipients - array of recipients (address-public key pairs)
	 */
	abstract publishMessage(
		me: IGenericAccount,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
	): Promise<Uint256 | null>;

	abstract broadcastMessage(me: IGenericAccount, contentData: Uint8Array): Promise<Uint256 | null>;

	/**
	 * Method to connect user's public key with his address
	 *
	 * @param publicKey - public key to attach to user's address
	 */
	abstract attachPublicKey(publicKey: Uint8Array): Promise<void>;

	abstract decryptMessageKey(
		senderPublicKey: PublicKey,
		recipientAccount: IGenericAccount,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array>;
}
