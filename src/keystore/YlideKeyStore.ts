import { EventEmitter } from 'eventemitter3';
import { YlideError, YlideErrorType } from '../errors';
import { AbstractStorage } from '../storage/AbstractStorage';
import { YlidePublicKeyVersion } from '../types';
import { YlideKey } from './YlideKey';
import { YlideKeyPair } from './YlideKeyPair';

export enum YlideKeyStoreEvent {
	KEY_ADDED = 'key_added',
	KEY_REMOVED = 'key_removed',
	KEYS_UPDATED = 'keys_updated',
}

/**
 * @category Keys
 * @description Class for managing Ylide keys for multiple accounts and blockchains
 */
export class YlideKeyStore extends EventEmitter {
	private readonly pfx = 'YLD5_';

	keys: YlideKey[] = [];

	constructor(
		readonly storage: AbstractStorage,
		readonly options: {
			onPasswordRequest: (reason: string) => Promise<string | null>;
			onDeriveRequest: (
				reason: string,
				blockchainGroup: string,
				wallet: string,
				address: string,
				magicString: string,
			) => Promise<Uint8Array | null>;
		},
	) {
		super();
	}

	/**
	 * Initializes underlaying storage engine and Keystore
	 */
	async init() {
		if (await this.storage.init()) {
			await this.load();
		} else {
			throw new Error('Storage is not available');
		}
	}

	key(str: string) {
		return this.pfx + str;
	}

	/**
	 * Method to construct new Ylide communication key without storing it.
	 *
	 * @param reason Reason for password/derivation request
	 * @param blockchainGroup Blockchain group name
	 * @param wallet Wallet name
	 * @param address User's address
	 * @param password Ylide password
	 * @returns `YlideKeyPair` instance
	 */
	async constructKeypairV3(reason: string, blockchainGroup: string, wallet: string, address: string) {
		const secretKey = await this.options.onDeriveRequest(
			reason,
			blockchainGroup,
			wallet,
			address,
			YlideKeyPair.getMagicStringV2(address, 1, 'no-password'),
		);
		if (!secretKey) {
			throw new YlideError(YlideErrorType.USER_CANCELLED);
		}
		return new YlideKeyPair(address, { isEncrypted: false, keydata: secretKey });
	}

	/**
	 * Method to construct new Ylide communication key without storing it.
	 *
	 * @param reason Reason for password/derivation request
	 * @param blockchainGroup Blockchain group name
	 * @param wallet Wallet name
	 * @param address User's address
	 * @param password Ylide password
	 * @returns `YlideKeyPair` instance
	 */
	async constructKeypairV2(
		reason: string,
		blockchainGroup: string,
		wallet: string,
		address: string,
		password: string,
	) {
		const secretKey = await this.options.onDeriveRequest(
			reason,
			blockchainGroup,
			wallet,
			address,
			YlideKeyPair.getMagicStringV2(address, 1, password),
		);
		if (!secretKey) {
			throw new YlideError(YlideErrorType.USER_CANCELLED);
		}
		return new YlideKeyPair(address, { isEncrypted: false, keydata: secretKey });
	}

	/**
	 * Method to construct new Ylide communication key without storing it.
	 *
	 * @param reason Reason for password/derivation request
	 * @param blockchainGroup Blockchain group name
	 * @param wallet Wallet name
	 * @param address User's address
	 * @param password Ylide password
	 * @returns `YlideKeyPair` instance
	 */
	async constructKeypairV1(
		reason: string,
		blockchainGroup: string,
		wallet: string,
		address: string,
		password: string,
	) {
		const secretKey = await this.options.onDeriveRequest(
			reason,
			blockchainGroup,
			wallet,
			address,
			YlideKeyPair.getMagicStringV1(address, 1, password),
		);
		if (!secretKey) {
			throw new YlideError(YlideErrorType.USER_CANCELLED);
		}
		return new YlideKeyPair(address, { isEncrypted: false, keydata: secretKey });
	}

	/**
	 * Method to store Ylide communication key.
	 *
	 * @param keypair YlideKeyPair instance (result of "constructKeypair" execution)
	 * @param blockchainGroup Blockchain group name
	 * @param wallet Wallet name
	 */
	async storeKey(keypair: YlideKeyPair, keyVersion: YlidePublicKeyVersion, blockchainGroup: string, wallet: string) {
		const key = new YlideKey(blockchainGroup, wallet, keypair.address, keypair, keyVersion);
		this.keys.push(key);
		this.emit(YlideKeyStoreEvent.KEY_ADDED, key);
		this.emit(YlideKeyStoreEvent.KEYS_UPDATED, this.keys);
		await this.save();
		return key;
	}

	/**
	 * Method to remove key from internal storage
	 *
	 * @param key `YlideKey` instance
	 */
	async delete(key: YlideKey) {
		const idx = this.keys.indexOf(key);
		if (idx > -1) {
			this.keys.splice(idx, 1);
			this.emit(YlideKeyStoreEvent.KEY_REMOVED, key);
			this.emit(YlideKeyStoreEvent.KEYS_UPDATED, this.keys);
			await this.save();
		}
	}

	/**
	 * Method to load keys from internal storage
	 */
	async load() {
		const initialized = await this.storage.readJSON<boolean>(this.key('init'));
		if (!initialized) {
			return;
		}
		const keysLength = await this.storage.readJSON<number>(this.key('keysLength'));
		if (!keysLength) {
			return;
		}
		this.keys = [];
		for (let keyIdx = 0; keyIdx < keysLength; keyIdx++) {
			const keyMeta = await this.storage.readJSON<{ blockchainGroup: string; wallet: string; address: string }>(
				this.key(`keyMeta${keyIdx}`),
			);
			const keyBytes = await this.storage.readBytes(this.key(`key${keyIdx}`));
			if (!keyMeta || !keyBytes) {
				continue;
			}
			const keypair = YlideKeyPair.fromBytes(keyBytes);
			if (keypair.address !== keyMeta.address) {
				continue;
			}
			const keyVersion = await this.storage.readJSON<number>(this.key(`keyVersion${keyIdx}`));
			if (!keyVersion) {
				continue;
			}
			const key = new YlideKey(keyMeta.blockchainGroup, keyMeta.wallet, keyMeta.address, keypair, keyVersion);
			this.keys.push(key);
			this.emit(YlideKeyStoreEvent.KEY_ADDED, key);
		}
		this.emit(YlideKeyStoreEvent.KEYS_UPDATED, this.keys);
	}

	/**
	 * Method to save keys to internal storage
	 */
	async save() {
		await this.storage.clear();
		await this.storage.storeJSON(this.key('init'), true);
		await this.storage.storeJSON(this.key('keysLength'), this.keys.length);
		for (let keyIdx = 0; keyIdx < this.keys.length; keyIdx++) {
			const keyData = this.keys[keyIdx];
			await this.storage.storeJSON(this.key(`keyMeta${keyIdx}`), {
				blockchainGroup: keyData.blockchainGroup,
				wallet: keyData.wallet,
				address: keyData.address,
			});
			await this.storage.storeBytes(this.key(`key${keyIdx}`), keyData.keypair.toBytes());
			await this.storage.storeJSON(this.key(`keyVersion${keyIdx}`), keyData.keyVersion);
		}
	}

	/**
	 * Method to retrieve key for certain address
	 *
	 * @param address User's address
	 * @returns Key reference or `null` if nothing was found.
	 */
	get(address: string) {
		const keyEntry = this.keys.find(t => t.address === address);
		if (!keyEntry) {
			return null;
		} else {
			return keyEntry.keypair;
		}
	}

	/**
	 * Method to retrieve all keys for certain address
	 *
	 * @param address User's address
	 * @returns Array of key references or empty array if nothing was found.
	 */
	getAll(address: string) {
		return this.keys.filter(t => t.address === address);
	}
}
