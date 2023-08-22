import { EventEmitter } from 'eventemitter3';

import type { MessageKey, IMessage, YlideKeyVersion, WalletAccount } from '..';
import type { Uint256 } from '../primitives/Uint256';
import type { EncryptionPublicKey } from '../primitives/EncryptionPublicKey';
import type { AbstractFaucetService } from './AbstractFaucetService';

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
 * import { AbstractWalletController } from '@ylide/sdk';
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
 *     	  const me = await this.getAuthenticatedAccount();
 *     	  if (!me) {
 *     		  throw new Error('Not authorized');
 *     	  }
 *     	  await this.blockchainController.registryContract.attachPublicKey(me.address, publicKey);
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

	/**
	 * Method to get blockchain group name
	 *
	 * @description Blockchain group is a name of the group of blockchains which are compatible with each other (e.g. "evm")
	 */
	abstract blockchainGroup(): string;

	/**
	 * Method to get wallet name (e.g. "metamask")
	 */
	abstract wallet(): string;

	/**
	 * Method to init controller. Must be called once before any other method.
	 * Automatically called when you instantiate using Ylide signleton.
	 */
	abstract init(): Promise<void>;

	/**
	 * Method to get whether wallet natively supports multiple accounts connection or not
	 * If not - you can still emulate multiaccounts by connection/disconnecting accounts automatically
	 *
	 */
	abstract isMultipleAccountsSupported(): boolean;

	/**
	 * Method to get name of the currently selected blockchain in this wallet
	 */
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
	 * Method used to create Ylide keypair: it gets signature from the wallet for a certain magicString
	 *
	 * @param account Account for which you request signature
	 * @param magicString - string which you get from YlideKeysRegistry
	 */
	abstract signMagicString(account: WalletAccount, magicString: string): Promise<Uint8Array>;

	/**
	 * Method to publish encrypted direct message using Ylide Protocol.
	 *
	 * @param from Account from which publish should occur
	 * @param feedId - mailing feedId to publish to (usually YLIDE_MAIN_FEED_ID)
	 * @param contentData - raw bytes content to publish
	 * @param recipients - array of recipients (address-public key pairs)
	 * @param options - additional options for this wallet (e.g. "network" for EVM-wallets)
	 */
	abstract sendMail(
		from: WalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
		options?: any,
	): Promise<SendMailResult>;

	/**
	 * Method to publish non-encrypted broadcasted message using Ylide Protocol.
	 *
	 * @param from Account from which publish should occur
	 * @param feedId - broadcasting feedId to publish to
	 * @param contentData - raw bytes content to publish
	 * @param options - additional options for this wallet (e.g. "network" for EVM-wallets)
	 */
	abstract sendBroadcast(
		from: WalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		options?: any,
	): Promise<SendBroadcastResult>;

	/**
	 * Method to register user's public key, so other users can discover it and send him messages.
	 *
	 * @param account Account for which connection should occur
	 * @param publicKey - public key to attach to user's address
	 * @param keyVersion - version of the key (e.g. YlideKeyVersion.KEY_V3)
	 * @param registrar - registrar code (e.g. 1 for Ylide Social Hub)
	 * @param options - additional options for this wallet (e.g. "network" for EVM-wallets)
	 */
	abstract attachPublicKey(
		account: WalletAccount,
		publicKey: Uint8Array,
		keyVersion: YlideKeyVersion,
		registrar: number,
		options?: any,
	): Promise<void>;

	/**
	 * Method to convert address to 32 bytes lowercase hex string (widely used in SDK)
	 */
	abstract addressToUint256(address: string): Uint256;

	/**
	 * Method to decrypt message key using native wallet encryption system
	 *
	 * @param recipientAccount Account of the recipient
	 * @param senderPublicKey - Public key of the sender (needed to calculate shared secret key)
	 * @param encryptedKey - Encrypted message key bytes
	 */
	abstract decryptMessageKey(
		recipientAccount: WalletAccount,
		senderPublicKey: EncryptionPublicKey,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array>;

	/**
	 * Method to get whether Ylide faucet is generally available for this wallet or not
	 */
	abstract isFaucetAvailable(): boolean;

	/**
	 * Method to get Ylide faucet service for this wallet
	 *
	 * @param options - additional options for this wallet (e.g. "faucetType" for EVM-wallets)
	 */
	abstract getFaucet(options?: any): Promise<AbstractFaucetService>;
}
