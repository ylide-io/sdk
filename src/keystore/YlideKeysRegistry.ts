import { PrivateKeyAvailabilityState, YlidePrivateKey } from './YlidePrivateKey';
import { getPrivateKey } from './getPrivateKey';
import { RemotePublicKey } from './RemotePublicKey';

import { PublicKey, PublicKeyType } from '../primitives';
import { YlideError, YlideErrorType } from '../errors';
import { YlideMisusageError } from '../errors/YlideMisusageError';
import { BrowserLocalStorage } from '../storage';

import { box as naclbox } from 'tweetnacl';

import type { AbstractStorage } from '../storage/AbstractStorage';
import type { YlidePrivateKeyHandlers } from './getPrivateKey';
import type { YlideKeyVersion } from '../primitives';

export class YlideKeysRegistry {
	private localPrivateKeys: Map<string, YlidePrivateKey[]> = new Map();
	private remotePublicKeys: Map<string, RemotePublicKey[]> = new Map();

	private storage: AbstractStorage;

	constructor(storage?: AbstractStorage, private readonly pfx = 'YLD6_') {
		if (!storage) {
			storage = new BrowserLocalStorage();
		}

		this.storage = storage;
	}

	private prefixedStorageKey(str: string) {
		return this.pfx + str;
	}

	/**
	 * Initializes underlaying storage engine and Keystore
	 */
	async init() {
		if (await this.storage.init()) {
			await this.load();
		} else {
			throw new YlideError(YlideErrorType.UNAVAILABLE, 'Storage is not available');
		}
	}

	private async loadLocalPrivateKeys() {
		this.localPrivateKeys = new Map();
		const privateKeysLength = await this.storage.readJSON<number>(this.prefixedStorageKey('privateKeysLength'));
		if (!privateKeysLength) {
			return;
		}
		for (let keyIdx = 0; keyIdx < privateKeysLength; keyIdx++) {
			const keyBytes = await this.storage.readBytes(this.prefixedStorageKey(`privateKey${keyIdx}`));
			if (!keyBytes) {
				console.warn(`Failed to load private key ${keyIdx}`);
				continue;
			}
			const key = YlidePrivateKey.fromBytes(keyBytes);
			this._addLocalPrivateKey(key);
		}
	}

	private async loadRemotePublicKeys() {
		this.remotePublicKeys = new Map();
		const publicKeysLength = await this.storage.readJSON<number>(this.prefixedStorageKey('publicKeysLength'));
		if (!publicKeysLength) {
			return;
		}
		for (let keyIdx = 0; keyIdx < publicKeysLength; keyIdx++) {
			const keyBytes = await this.storage.readBytes(this.prefixedStorageKey(`publicKey${keyIdx}`));
			if (!keyBytes) {
				console.warn(`Failed to load public key ${keyIdx}`);
				continue;
			}
			const key = RemotePublicKey.fromBytes(keyBytes);
			this._addRemotePublicKey(key);
		}
	}

	private async saveLocalPrivateKeys() {
		let keyIdx = 0;
		for (const [address, keys] of this.localPrivateKeys.entries()) {
			for (const key of keys) {
				await this.storage.storeBytes(this.prefixedStorageKey(`privateKey${keyIdx}`), key.toBytes());
				keyIdx++;
			}
		}
		await this.storage.storeJSON(this.prefixedStorageKey('privateKeysLength'), keyIdx);
	}

	private async saveRemotePublicKeys() {
		let keyIdx = 0;
		for (const [address, keys] of this.remotePublicKeys.entries()) {
			for (const key of keys) {
				await this.storage.storeBytes(this.prefixedStorageKey(`publicKey${keyIdx}`), key.toBytes());
				keyIdx++;
			}
		}
		await this.storage.storeJSON(this.prefixedStorageKey('publicKeysLength'), keyIdx);
	}

	/**
	 * Method to load keys from internal storage
	 */
	async load() {
		const initialized = await this.storage.readJSON<boolean>(this.prefixedStorageKey('init'));
		if (!initialized) {
			return;
		}
		await this.loadLocalPrivateKeys();
		await this.loadRemotePublicKeys();
	}

	/**
	 * Method to clear internal storage
	 */
	async clear() {
		const keys = await this.storage.getKeys();
		for (const key of keys) {
			if (key.startsWith(this.pfx)) {
				await this.storage.delete(key);
			}
		}
	}

	/**
	 * Method to save keys to internal storage
	 */
	async save() {
		await this.clear();
		await this.storage.storeJSON(this.prefixedStorageKey('init'), true);
		await this.saveLocalPrivateKeys();
		await this.saveRemotePublicKeys();
	}

	private _addLocalPrivateKey(key: YlidePrivateKey) {
		const existingKeys = this.localPrivateKeys.get(key.address);
		if (!existingKeys) {
			this.localPrivateKeys.set(key.address, [key]);
		} else {
			const existingKeyIdx = existingKeys.findIndex(k => k.publicKey.equals(key.publicKey));
			if (existingKeyIdx === -1) {
				existingKeys.push(key);
			} else {
				const existingKey = existingKeys[existingKeyIdx];
				// check if key availability state is higher
				if (
					(existingKey.availabilityState === PrivateKeyAvailabilityState.UNAVAILABLE &&
						key.availabilityState !== PrivateKeyAvailabilityState.UNAVAILABLE) ||
					(existingKey.availabilityState === PrivateKeyAvailabilityState.ENCRYPTED &&
						key.availabilityState === PrivateKeyAvailabilityState.AVAILABLE)
				) {
					existingKeys.splice(existingKeyIdx, 1, key);
				}
			}
		}
	}

	private _addRemotePublicKey(key: RemotePublicKey) {
		const existingKeys = this.remotePublicKeys.get(key.address);
		if (!existingKeys || !existingKeys.find(k => k.publicKey.equals(key.publicKey))) {
			const keys = this.remotePublicKeys.get(key.address) ?? [];
			keys.push(key);
			this.remotePublicKeys.set(key.address, keys);
		}
		const isPrivateKeyExists = this.localPrivateKeys
			.get(key.address)
			?.some(pk => pk.publicKey.equals(key.publicKey));
		if (!isPrivateKeyExists) {
			const newPrivateKey = new YlidePrivateKey(key.blockchainGroup, key.address, key.publicKey, null);
			this._addLocalPrivateKey(newPrivateKey);
		}
	}

	private _removeLocalPrivateKey(key: YlidePrivateKey) {
		const existingKeys = this.localPrivateKeys.get(key.address);
		if (existingKeys) {
			const existingKeyIdx = existingKeys.findIndex(k => k === key);
			if (existingKeyIdx !== -1) {
				existingKeys.splice(existingKeyIdx, 1);
			}
		}
	}

	private _removeRemotePublicKey(key: RemotePublicKey) {
		const existingKeys = this.remotePublicKeys.get(key.address);
		if (existingKeys) {
			const existingKeyIdx = existingKeys.findIndex(k => k === key);
			if (existingKeyIdx !== -1) {
				existingKeys.splice(existingKeyIdx, 1);
			}
		}
	}

	public async addLocalPrivateKey(key: YlidePrivateKey) {
		this._addLocalPrivateKey(key);
		await this.save();
	}

	public async addRemotePublicKey(key: RemotePublicKey) {
		this._addRemotePublicKey(key);
		await this.save();
	}

	public async addRemotePublicKeys(keys: RemotePublicKey[]) {
		for (const key of keys) {
			this._addRemotePublicKey(key);
		}
		await this.save();
	}

	public async removeLocalPrivateKey(key: YlidePrivateKey) {
		this._removeLocalPrivateKey(key);
		await this.save();
	}

	public async removeRemotePublicKey(key: RemotePublicKey) {
		this._removeRemotePublicKey(key);
		await this.save();
	}

	public async removeRemotePublicKeys(keys: RemotePublicKey[]) {
		for (const key of keys) {
			this._removeRemotePublicKey(key);
		}
		await this.save();
	}

	public async instantiateNewPrivateKey(
		blockchainGroup: string,
		address: string,
		keyVersion: YlideKeyVersion,
		availabilityState: PrivateKeyAvailabilityState,
		handlers: YlidePrivateKeyHandlers,
	) {
		if (availabilityState === PrivateKeyAvailabilityState.ENCRYPTED && !handlers.onYlidePasswordRequest) {
			throw new YlideMisusageError(
				'YlideKeysRegistry',
				'Ylide password request handler is not set, but it is required for the encryption of YlideKey',
			);
		}
		const result = await getPrivateKey(keyVersion, address, 1, handlers);
		const { privateKeyBytes } = result;
		let { password } = result;

		const publicKeyBytes = naclbox.keyPair.fromSecretKey(privateKeyBytes).publicKey;
		const publicKey = new PublicKey(PublicKeyType.YLIDE, keyVersion, publicKeyBytes);
		const key = new YlidePrivateKey(blockchainGroup, address, publicKey, {
			isEncrypted: false,
			privateKey: privateKeyBytes,
		});
		if (availabilityState === PrivateKeyAvailabilityState.ENCRYPTED) {
			if (!password) {
				const ylidePassword = await handlers.onYlidePasswordRequest!(address);
				if (!ylidePassword) {
					throw new YlideError(YlideErrorType.WAS_CANCELLED, `Can't encrypt YlideKey without Ylide password`);
				}
				password = ylidePassword;
			}
			await key.storeEncrypted(password);
		} else if (availabilityState === PrivateKeyAvailabilityState.UNAVAILABLE) {
			await key.storeNothing();
		}

		return key;
	}

	public getLocalPrivateKeyForRemotePublicKey(publicKey: RemotePublicKey): YlidePrivateKey | null {
		const keys = this.localPrivateKeys.get(publicKey.address) ?? [];
		for (const key of keys) {
			if (key.publicKey.equals(publicKey.publicKey)) {
				return key;
			}
		}
		return null;
	}

	public getLocalPrivateKeyForPublicKeySignature(
		address: string,
		publicKeySignature: number,
	): YlidePrivateKey | null {
		return this.localPrivateKeys.get(address)?.find(k => k.publicKey.signature === publicKeySignature) ?? null;
	}

	public getLocalPrivateKeys(address: string): YlidePrivateKey[] {
		return this.localPrivateKeys.get(address) ?? [];
	}

	public getRemotePublicKeys(address: string): RemotePublicKey[] {
		return this.remotePublicKeys.get(address) ?? [];
	}

	public getFreshestRemotePublicKey(address: string): RemotePublicKey | null {
		const keys = this.getRemotePublicKeys(address);
		let freshestKey: RemotePublicKey | null = null;
		for (const key of keys) {
			if (freshestKey === null || freshestKey.timestamp < key.timestamp) {
				freshestKey = key;
			}
		}
		return freshestKey;
	}
}
