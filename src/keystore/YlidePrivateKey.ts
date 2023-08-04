import { YlidePrivateKeyHelper } from './YlidePrivateKeyHelper';
import { YlideUnencryptedKeyPair } from './YlideUnencryptedKeyPair';
import { getPrivateKey } from './getPrivateKey';

import { Serializable } from '../serialize';
import { PublicKey } from '../primitives';
import { YlideMisusageError } from '../errors/YlideMisusageError';
import { YlideError, YlideErrorType } from '../errors';

import { box as naclbox } from 'tweetnacl';
import { DynamicSmartBuffer, SmartBuffer } from '@ylide/smart-buffer';

import type { YlidePrivateKeyHandlers } from './getPrivateKey';
import type { BoxKeyPair } from 'tweetnacl';

export enum PrivateKeyAvailabilityState {
	AVAILABLE = 'available',
	ENCRYPTED = 'encrypted',
	UNAVAILABLE = 'unavailable',
}

/**
 * @category Keys
 * @description This class is designate to store and interact with Ylide communication keypairs
 * @see [Basics of key storage](https://ylide-io.github.io/sdk/handbook/basics#keys-storage) to understand common concepts used here
 */
export class YlidePrivateKey extends Serializable<YlidePrivateKey>() {
	private readonly keyIndex = 1;
	private _keypair: BoxKeyPair | null = null;

	constructor(
		public readonly blockchainGroup: string,
		public readonly address: string,

		public readonly publicKey: PublicKey,

		private privateKey:
			| null
			| { isEncrypted: false; privateKey: Uint8Array }
			| { isEncrypted: true; encryptedPrivateKey: Uint8Array },
	) {
		super();
		if (privateKey && privateKey.isEncrypted === false) {
			this._keypair = naclbox.keyPair.fromSecretKey(privateKey.privateKey);
			if (!this.publicKey.keyEquals(this._keypair.publicKey)) {
				throw new YlideMisusageError('YlidePrivateKey', `Calculated YlidePrivateKey has different public key`);
			}
		}
	}

	get availabilityState(): PrivateKeyAvailabilityState {
		if (!this.privateKey) {
			return PrivateKeyAvailabilityState.UNAVAILABLE;
		} else if (this.privateKey.isEncrypted) {
			return PrivateKeyAvailabilityState.ENCRYPTED;
		} else {
			return PrivateKeyAvailabilityState.AVAILABLE;
		}
	}

	/**
	 * Method to deserialize `YlidePrivateKeyPair` from raw bytes
	 *
	 * @param bytes Raw Ylide key bytes
	 * @returns Instance of `YlidePrivateKeyPair`
	 */
	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);

		const blockchainGroup = buf.readString8Length();
		const address = buf.readString8Length();

		const publicKey = PublicKey.fromBytes(buf.readBytes8Length());

		const isEncrypted = buf.readUint8() === 1;
		const privateKey = buf.readBytes8Length();

		if (isEncrypted) {
			if (privateKey.length === 0) {
				throw new YlideMisusageError(
					'YlidePrivateKey',
					'Private key is encrypted, but encrypted key blob is empty',
				);
			}
			return new YlidePrivateKey(blockchainGroup, address, publicKey, {
				isEncrypted,
				encryptedPrivateKey: privateKey,
			});
		} else {
			return new YlidePrivateKey(
				blockchainGroup,
				address,
				publicKey,
				privateKey.length === 0
					? null
					: {
							isEncrypted,
							privateKey,
					  },
			);
		}
	}

	/**
	 * Method to serialize `YlidePrivateKeyPair` to raw bytes
	 *
	 * @returns Raw Ylide key bytes
	 */
	toBytes(): Uint8Array {
		const buf = new DynamicSmartBuffer();

		buf.writeString8Length(this.blockchainGroup);
		buf.writeString8Length(this.address);

		buf.writeBytes8Length(this.publicKey.toBytes());

		buf.writeUint8(this.privateKey?.isEncrypted ? 1 : 0);

		const privateKeyBytes = this.privateKey
			? this.privateKey.isEncrypted
				? this.privateKey.encryptedPrivateKey
				: this.privateKey.privateKey
			: new Uint8Array(0);
		buf.writeBytes8Length(privateKeyBytes);

		return buf.bytes;
	}

	/**
	 * Method to decrypt internally stored private key
	 *
	 * @param password Ylide password
	 * @returns Raw private key
	 */
	private async getDecryptedKey(password: string) {
		if (this.privateKey?.isEncrypted) {
			return YlidePrivateKeyHelper.decryptKeyByPassword(this.privateKey.encryptedPrivateKey, password);
		} else {
			throw new YlideMisusageError('YlidePrivateKey', 'YlidePrivateKey is not encrypted');
		}
	}

	/**
	 * Method to switch from encrypted storage to plaintext storage of the key
	 *
	 * @param password Ylide password
	 */
	async storeUnencrypted(password: string) {
		if (!this.privateKey) {
			throw new YlideMisusageError('YlidePrivateKey', 'YlidePrivateKey has no private key');
		}
		if (!this.privateKey.isEncrypted) {
			return;
		}
		this._keypair = naclbox.keyPair.fromSecretKey(await this.getDecryptedKey(password));
		this.privateKey = {
			isEncrypted: false,
			privateKey: this._keypair.secretKey,
		};
	}

	/**
	 * Method to switch from plaintext storage to encrypted storage of the key
	 *
	 * @param password Ylide password
	 */
	async storeEncrypted(password: string) {
		if (!this.privateKey) {
			throw new YlideMisusageError('YlidePrivateKey', 'YlidePrivateKey has no private key');
		}
		if (this.privateKey.isEncrypted) {
			return;
		}
		const encryptedPrivateKey = YlidePrivateKeyHelper.encryptKeyByPassword(this.privateKey.privateKey, password);
		this.privateKey = {
			isEncrypted: true,
			encryptedPrivateKey,
		};
		this._keypair = null;
	}

	/**
	 * Method to switch from plaintext storage to encrypted storage of the key
	 *
	 * @param password Ylide password
	 */
	async changeEncryptionPassword(oldPassword: string, newPassword: string) {
		if (!this.privateKey) {
			throw new YlideMisusageError('YlidePrivateKey', 'YlidePrivateKey has no private key');
		}
		if (!this.privateKey.isEncrypted) {
			throw new YlideMisusageError(
				'YlidePrivateKey',
				'YlidePrivateKey is not encrypted. To set a password, use "storeEncrypted" method',
			);
		}
		const decryptedPrivateKey = await this.getDecryptedKey(oldPassword);
		const encryptedPrivateKey = YlidePrivateKeyHelper.encryptKeyByPassword(decryptedPrivateKey, newPassword);
		this.privateKey = {
			isEncrypted: true,
			encryptedPrivateKey,
		};
		this._keypair = null;
	}

	async storeNothing() {
		this.privateKey = null;
		this._keypair = null;
	}

	/**
	 * Method for boxed execution of a function with provided decrypted communication key. Right after the execution key is removed from memory.
	 *
	 * @param reason Reason for accessing communication key
	 * @param processor Async callback which uses decrypted key
	 */
	async execute<T = void>(
		processor: (keypair: YlideUnencryptedKeyPair) => Promise<T>,
		handlers?: YlidePrivateKeyHandlers,
	): Promise<T> {
		if (this.privateKey && !this.privateKey.isEncrypted) {
			const keypair = new YlideUnencryptedKeyPair(naclbox.keyPair.fromSecretKey(this.privateKey.privateKey));
			return await processor(keypair);
		} else if (this.privateKey && this.privateKey.isEncrypted) {
			if (!handlers?.onYlidePasswordRequest) {
				throw new YlideMisusageError(
					'YlidePrivateKey',
					'YlidePrivateKey is encrypted, but password request handler is not set',
				);
			}
			const password = await handlers.onYlidePasswordRequest(this.address);
			if (!password) {
				throw new YlideError(
					YlideErrorType.WAS_CANCELLED,
					`Can't decrypt encrypted YlidePrivateKey without password`,
				);
			}
			const secretKey = await this.getDecryptedKey(password);
			const keypair = new YlideUnencryptedKeyPair(naclbox.keyPair.fromSecretKey(secretKey));
			if (!this.publicKey.keyEquals(keypair.publicKey)) {
				throw new YlideMisusageError('YlidePrivateKey', `Decrypted YlidePrivateKey has different public key`);
			}
			return await processor(keypair);
		} else {
			if (!handlers) {
				throw new YlideMisusageError(
					'YlidePrivateKey',
					'YlidePrivateKey is not available and no handlers for generation provided',
				);
			}
			const { privateKeyBytes } = await getPrivateKey(this.publicKey.keyVersion, this.address, 1, handlers);
			if (!privateKeyBytes) {
				throw new YlideError(YlideErrorType.WAS_CANCELLED, `Can't get private key for YlidePrivateKey`);
			}
			const keypair = new YlideUnencryptedKeyPair(naclbox.keyPair.fromSecretKey(privateKeyBytes));
			if (!this.publicKey.keyEquals(keypair.publicKey)) {
				throw new YlideError(
					YlideErrorType.DECRYPTION_KEY_UNAVAILABLE,
					`Calculated YlidePrivateKey has different public key`,
				);
			}
			return await processor(keypair);
		}
	}
}
