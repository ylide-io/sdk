import { EventEmitter } from 'eventemitter3';

import type { MessageKey, IMessage, YlideKeyVersion, WalletAccount } from '..';
import type { Uint256 } from '../primitives/Uint256';
import type { EncryptionPublicKey } from '../primitives/EncryptionPublicKey';

export enum WalletEvent {
	BLOCKCHAIN_CHANGED = 'blockchain_changed',
	ACCOUNT_CHANGED = 'account_changed',
	LOGOUT = 'logout',
	LOGIN = 'login',
}

export type SwitchAccountCallback = (currentAccount: WalletAccount | null, needAccount: WalletAccount) => Promise<void>;

export interface SendMailResult {
	pushes: { recipient: Uint256; push: IMessage }[];
}

export interface SendBroadcastResult {
	pushes: { push: IMessage }[];
}

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
export abstract class AbstractWalletController extends EventEmitter<WalletEvent> {
	onSwitchAccountRequest: SwitchAccountCallback | null = null;

	constructor(options?: any) {
		super();
	}

	protected async switchAccountRequest(currentAccount: WalletAccount | null, needAccount: WalletAccount) {
		if (this.onSwitchAccountRequest) {
			await this.onSwitchAccountRequest(currentAccount, needAccount);
		}
	}

	on(event: WalletEvent.BLOCKCHAIN_CHANGED, fn: (newBlockchain: string) => void, context?: any): this;
	on(
		event: WalletEvent.LOGIN | WalletEvent.ACCOUNT_CHANGED,
		fn: (newAccount: WalletAccount) => void,
		context?: any,
	): this;
	on(event: WalletEvent.LOGOUT, fn: () => void, context?: any): this;
	on(event: WalletEvent, fn: (...args: any[]) => void, context?: any): this {
		return super.on(event, fn, context);
	}

	abstract blockchainGroup(): string;
	abstract wallet(): string;

	abstract init(): Promise<void>;

	abstract isMultipleAccountsSupported(): boolean;

	abstract getCurrentBlockchain(): Promise<string>;

	/**
	 * Method to get account currently authenticated by the wallet for this app
	 */
	abstract getAuthenticatedAccount(): Promise<WalletAccount | null>;

	/**
	 * Method to request wallet to authenticate some account for this app
	 */
	abstract requestAuthentication(): Promise<WalletAccount | null>;

	/**
	 * Method to request wallet to revoke authenticaion of this app
	 */
	abstract disconnectAccount(account: WalletAccount): Promise<void>;

	/**
	 * Method used to create Ylide keypair: it gets signature from the wallet for a certain magicString (usually containing Ylide password)
	 *
	 * @param account Account for which you request signature
	 * @param magicString - string which consists of some fixed part and dynamic part like Ylide password
	 */
	abstract signMagicString(account: WalletAccount, magicString: string): Promise<Uint8Array>;

	/**
	 * Method to publish message using Ylide Protocol.
	 *
	 * @param me Account from which publish should occur
	 * @param contentData - raw bytes content to publish
	 * @param recipients - array of recipients (address-public key pairs)
	 */
	abstract sendMail(
		from: WalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
		options?: any,
	): Promise<SendMailResult>;

	abstract sendBroadcast(
		from: WalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		options?: any,
	): Promise<SendBroadcastResult>;

	/**
	 * Method to connect user's public key with his address
	 *
	 * @param account Account for which connection should occur
	 * @param publicKey - public key to attach to user's address
	 */
	abstract attachPublicKey(
		account: WalletAccount,
		publicKey: Uint8Array,
		keyVersion: YlideKeyVersion,
		registrar: number,
		options?: any,
	): Promise<void>;

	/**
	 * Method to convert address to 32 bytes array
	 */
	abstract addressToUint256(address: string): Uint256;

	/**
	 * Method to decrypt message key using native wallet encryption system
	 *
	 * @param recipientAccount Account of the recipient
	 * @param publicKey - public key to attach to user's address
	 */
	abstract decryptMessageKey(
		recipientAccount: WalletAccount,
		senderPublicKey: EncryptionPublicKey,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array>;
}
