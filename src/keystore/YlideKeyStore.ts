import { AbstractStorage } from '../storage/AbstractStorage';
import { YlideKeyPair } from './YlideKeyPair';

/**
 * @category Keys
 * @description Class for managing Ylide keys for multiple accounts and blockchains
 */
export class YlideKeyStore {
	private readonly pfx = 'YLD2_';

	keys: {
		blockchain: string;
		wallet: string;
		address: string;
		key: YlideKeyPair;
	}[] = [];

	constructor(
		readonly storage: AbstractStorage,
		readonly options: {
			onPasswordRequest: (reason: string) => Promise<string | null>;
			onDeriveRequest: (
				reason: string,
				blockchain: string,
				wallet: string,
				address: string,
				magicString: string,
			) => Promise<Uint8Array | null>;
		},
	) {}

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
	 * Method to create and store new Ylide communication key.
	 *
	 * @param reason Reason for password/derivation request
	 * @param blockchain Blockchain name
	 * @param wallet Wallet name
	 * @param address User's address
	 * @param password Ylide password
	 * @returns `YlideKeyPair` instance
	 */
	async create(reason: string, blockchain: string, wallet: string, address: string, password: string) {
		const secretKey = await this.options.onDeriveRequest(
			reason,
			blockchain,
			wallet,
			address,
			YlideKeyPair.getMagicString(address, 1, password),
		);
		if (!secretKey) {
			throw new Error('Interrupted');
		}
		const key = new YlideKeyPair(address, { isEncrypted: false, keydata: secretKey });
		this.keys.push({
			blockchain,
			wallet,
			address,
			key,
		});
		await this.save();
		return key;
	}

	/**
	 * Method to remove key from internal storage
	 * @param key `YlideKeyPair` reference
	 */
	async delete(key: { blockchain: string; address: string; key: YlideKeyPair }) {
		this.keys = this.keys.filter(_key => key !== _key);
		await this.save();
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
			const keyMeta = await this.storage.readJSON<{ blockchain: string; wallet: string; address: string }>(
				this.key(`keyMeta${keyIdx}`),
			);
			const keyBytes = await this.storage.readBytes(this.key(`key${keyIdx}`));
			if (!keyMeta || !keyBytes) {
				continue;
			}
			const key = YlideKeyPair.fromBytes(keyBytes);
			if (key.address !== keyMeta.address) {
				continue;
			}
			this.keys.push({
				blockchain: keyMeta.blockchain,
				wallet: keyMeta.wallet,
				address: keyMeta.address,
				key,
			});
		}
	}

	/**
	 * Method to save keys to internal storage
	 */
	async save() {
		await this.storage.storeJSON(this.key('init'), true);
		await this.storage.storeJSON(this.key('keysLength'), this.keys.length);
		for (let keyIdx = 0; keyIdx < this.keys.length; keyIdx++) {
			const keyData = this.keys[keyIdx];
			await this.storage.storeJSON(this.key(`keyMeta${keyIdx}`), {
				blockchain: keyData.blockchain,
				address: keyData.address,
			});
			await this.storage.storeBytes(this.key(`key${keyIdx}`), keyData.key.toBytes());
		}
	}

	/**
	 * Method to retrieve key for certain address
	 * @param address User's address
	 * @returns Key reference or `null` if nothing was found.
	 */
	get(address: string) {
		const keyEntry = this.keys.find(t => t.address === address);
		if (!keyEntry) {
			return null;
		} else {
			return keyEntry.key;
		}
	}
}
