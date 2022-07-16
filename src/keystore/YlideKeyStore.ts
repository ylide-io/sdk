import { AbstractStorage } from '../storage/AbstractStorage';
import { YlideKeyPair } from './YlideKeyPair';

export class YlideKeyStore {
	private readonly pfx = 'YLD1_';

	onPasswordRequest: ((reason: string) => Promise<string | null>) | null = null;
	onDeriveRequest: ((reason: string, magicString: string) => Promise<Uint8Array | null>) | null = null;

	keys: {
		blockchain: string;
		address: string;
		key: YlideKeyPair;
	}[] = [];

	constructor(
		readonly storage: AbstractStorage,
		private readonly options: {
			onPasswordRequest: (reason: string) => Promise<string | null>;
			onDeriveRequest: (
				reason: string,
				blockchain: string,
				address: string,
				magicString: string,
			) => Promise<Uint8Array | null>;
		},
	) {}

	key(str: string) {
		return this.pfx + str;
	}

	async create(reason: string, blockchain: string, address: string, password: string) {
		const secretKey = await this.options.onDeriveRequest(
			reason,
			blockchain,
			address,
			YlideKeyPair.getMagicString(address, 1, password),
		);
		if (!secretKey) {
			throw new Error('Interrrupted');
		}
		const key = new YlideKeyPair(address, { isEncrypted: false, keydata: secretKey });
		this.keys.push({
			blockchain,
			address,
			key,
		});
		await this.save();
		return key;
	}

	async delete(key: { blockchain: string; address: string; key: YlideKeyPair }) {
		this.keys = this.keys.filter(_key => key !== _key);
		await this.save();
	}

	async load() {
		const initialized = await this.storage.readJSON<boolean>(this.key('init'));
		if (!initialized) {
			return;
		}
		const keysLength = await this.storage.readJSON<number>(this.key('keysLength'));
		if (!keysLength) {
			return;
		}
		for (let keyIdx = 0; keyIdx < keysLength; keyIdx++) {
			const keyMeta = await this.storage.readJSON<{ blockchain: string; address: string }>(
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
				address: keyMeta.address,
				key,
			});
		}
	}

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

	get(blockchain: string, address: string) {
		const keyEntry = this.keys.find(t => t.blockchain === blockchain && t.address === address);
		if (!keyEntry) {
			return null;
		} else {
			return keyEntry.key;
		}
	}
}