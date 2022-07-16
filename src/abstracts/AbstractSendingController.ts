import { MessageContent } from '../content/MessageContent';
import { YlideUnencryptedKeyPair } from '../keystore/YlideUnencryptedKeyPair';
import { IGenericAccount } from '../types/IGenericAccount';

export abstract class AbstractSendingController {
	constructor(options: any) {
		//
	}
	// wallet block
	static async isWalletAvailable(): Promise<boolean> {
		throw new Error(`Method not implemented`);
	}

	static walletType(): string {
		throw new Error(`Method not implemented`);
	}

	static blockchainType(): string {
		throw new Error(`Method not implemented`);
	}

	// account block
	abstract getAuthenticatedAccount(): Promise<IGenericAccount | null>;
	abstract requestAuthentication(): Promise<IGenericAccount | null>;
	abstract disconnectAccount(): Promise<void>;

	// keygen block
	abstract deriveMessagingKeypair(magicString: string): Promise<Uint8Array>;

	// message send block
	abstract sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: { address: string; publicKey: Uint8Array }[],
	): Promise<string | null>;

	abstract attachPublicKey(publicKey: Uint8Array): Promise<void>;
}

export type AbstractSendingControllerClass = typeof AbstractSendingController;

export type AbstractSendingControllerConstructor = new (options: any) => AbstractSendingController;
