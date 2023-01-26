import SmartBuffer from '@ylide/smart-buffer';
import nacl, { BoxKeyPair } from 'tweetnacl';
import { sha256 } from '../crypto/sha256';
import { symmetricDecrypt, symmetricEncrypt } from '../crypto/symmetric';
import { YlideUnencryptedKeyPair } from './YlideUnencryptedKeyPair';

/**
 * @category Keys
 * @description This class is designate to store and interact with Ylide communication keypairs
 * @see [Basics of key storage](https://ylide-io.github.io/sdk/handbook/basics#keys-storage) to understand common concepts used here
 */
export class YlideKeyPair {
	private readonly keyIndex = 1;
	private keydata: Uint8Array;

	readonly publicKey: Uint8Array;
	private _isEncrypted: boolean;

	private _keypair: BoxKeyPair | null = null;

	onPasswordRequest: ((reason: string) => Promise<string | null>) | null = null;

	constructor(
		readonly address: string,
		data:
			| { isEncrypted: false; keydata: Uint8Array }
			| { isEncrypted: true; keydata: Uint8Array; publicKey: Uint8Array },
	) {
		this._isEncrypted = data.isEncrypted;
		this.keydata = data.keydata;
		if (!data.isEncrypted) {
			this._keypair = nacl.box.keyPair.fromSecretKey(data.keydata);
			this.publicKey = this._keypair.publicKey;
		} else {
			this.publicKey = data.publicKey;
		}
	}

	get isEncrypted() {
		return this._isEncrypted;
	}

	get keypair() {
		return this._keypair;
	}

	/**
	 * Method to deserialize `YlideKeyPair` from raw bytes
	 *
	 * @param bytes Raw Ylide key bytes
	 * @returns Instance of `YlideKeyPair`
	 */
	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const address = buf.readBuffer8Length().toUTF8String();
		const publicKey = buf.readBytes(32);
		const isEncrypted = buf.readUint8() === 1;
		const keydata = buf.readBytes8Length();

		return new YlideKeyPair(address, {
			isEncrypted,
			keydata,
			publicKey,
		});
	}

	/**
	 * Method to serialize `YlideKeyPair` to raw bytes
	 *
	 * @returns Raw Ylide key bytes
	 */
	toBytes(): Uint8Array {
		const addressBuffer = SmartBuffer.ofUTF8String(this.address).bytes;

		const buf = SmartBuffer.ofSize(1 + addressBuffer.length + 1 + 1 + 32 + this.keydata.length);
		buf.writeBytes8Length(addressBuffer);
		buf.writeBytes(this.publicKey);
		buf.writeUint8(this._isEncrypted ? 1 : 0);
		buf.writeBytes8Length(this.keydata);

		return buf.bytes;
	}

	/**
	 * Method to generate dynamic magic string for signing
	 *
	 * @see [Initialization of communication keys](https://ylide-io.github.io/sdk/handbook/basics#keys-init)
	 * @param address User's address
	 * @param keyIndex Index of this key
	 * @param password Ylide password
	 * @returns String to be signed using user's wallet
	 */
	static getMagicString(address: string, keyIndex: number, password: string) {
		const magicString = new SmartBuffer(
			sha256(sha256(sha256(sha256(sha256(sha256(sha256(`$ylide${address}${keyIndex}${password}ylide$`))))))),
		).toBase64String();
		return `I authorize this app to decrypt my messages in the Ylide Protocol for the following address: ${address}.\n\nI understand that if I provide my Ylide Password and this signature to any malicious app, the attacker would be able to read my messages.\n\nThis is not a transaction, and confirmation doesn’t cost you anything.\n\nNonce: ${magicString}`;
	}

	/**
	 * Method to encrypt key by password
	 *
	 * @param key Raw private key bytes
	 * @param password Password to encrypt
	 * @returns Encrypted bytes
	 */
	static encryptKeyByPassword(key: Uint8Array, password: string) {
		return symmetricEncrypt(key, sha256(password));
	}

	/**
	 * Method to decrypt key using password
	 *
	 * @param key Raw encrypted private key bytes
	 * @param password Password to decrypt
	 * @returns Raw private key
	 */
	static decryptKeyByPassword(keydata: Uint8Array, password: string) {
		return symmetricDecrypt(keydata, sha256(password));
	}

	/**
	 * Fabric to create new communication key for user
	 *
	 * @param address User's address
	 * @param password Ylide password
	 * @param deriver Deriver callback to get signature of magic string
	 * @returns Instance of `YlideKeyPair`
	 */
	static async create(address: string, password: string, deriver: (magicString: string) => Promise<Uint8Array>) {
		const keyIndex = 1;
		const magicString = this.getMagicString(address, keyIndex, password);
		const secretKey = await deriver(magicString);
		if (secretKey.length !== 32) {
			throw new Error('Secret key must have 32 bytes');
		}

		return new YlideKeyPair(address, {
			isEncrypted: true,
			keydata: this.encryptKeyByPassword(secretKey, password),
			publicKey: nacl.box.keyPair.fromSecretKey(secretKey).publicKey,
		});
	}

	/**
	 * Method to decrypt internally stored private key
	 *
	 * @param password Ylide password
	 * @returns Raw private key
	 */
	private async getDecryptedKey(password: string) {
		if (!this._isEncrypted) {
			return this.keydata;
		}

		return YlideKeyPair.decryptKeyByPassword(this.keydata, password);
	}

	/**
	 * Method to switch from encrypted storage to plaintext storage of the key
	 *
	 * @param password Ylide password
	 */
	async storeUnencrypted(password: string) {
		if (!this._isEncrypted) {
			return;
		}
		this._keypair = nacl.box.keyPair.fromSecretKey(await this.getDecryptedKey(password));
		this.keydata = this._keypair.secretKey;
		this._isEncrypted = false;
	}

	/**
	 * Method to switch from plaintext storage to encrypted storage of the key
	 *
	 * @param password Ylide password
	 */
	async storeEncrypted(password: string) {
		if (this._isEncrypted || !this._keypair) {
			return;
		}
		this.keydata = YlideKeyPair.encryptKeyByPassword(this._keypair.secretKey, password);
		this._keypair = null;
		this._isEncrypted = true;
	}

	/**
	 * Method to decrypt `YlideKeyPair` into `YlideUnencryptedKeyPair` which can be used for sending/reading messages
	 *
	 * @param reason Reason for accessing communication key
	 * @returns `YlideUnencryptedKeyPair` instance
	 */
	async decrypt(reason: string): Promise<YlideUnencryptedKeyPair> {
		if (this._isEncrypted) {
			if (!this.onPasswordRequest) {
				throw new Error('KeyStore is encrypted, but password request handler is not set');
			}
			const password = await this.onPasswordRequest(reason);
			if (!password) {
				throw new Error(`Can't decrypt KeyStore without password`);
			}
			const secretKey = await this.getDecryptedKey(password);
			return new YlideUnencryptedKeyPair(nacl.box.keyPair.fromSecretKey(secretKey));
		} else {
			return new YlideUnencryptedKeyPair(nacl.box.keyPair.fromSecretKey(this.keydata));
		}
	}

	/**
	 * Method for boxed execution of a function with provided decrypted communication key. Right after the execution key is removed from memory.
	 *
	 * @param reason Reason for accessing communication key
	 * @param processor Async callback which uses decrypted key
	 */
	async execute<T = void>(reason: string, processor: (keypair: YlideUnencryptedKeyPair) => Promise<T>): Promise<T> {
		const keypair = await this.decrypt(reason);
		return await processor(keypair);
	}
}
