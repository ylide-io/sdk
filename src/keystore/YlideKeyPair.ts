import SmartBuffer from '@ylide/smart-buffer';
import nacl, { BoxKeyPair } from 'tweetnacl';
import { sha256 } from '../crypto/sha256';
import { symmetricDecrypt, symmetricEncrypt } from '../crypto/symmetric';
import { YlideUnencryptedKeyPair } from './YlideUnencryptedKeyPair';

export class YlideKeyPair {
	private readonly keyIndex = 1;

	keydata: Uint8Array;
	publicKey: Uint8Array;
	isEncrypted: boolean;

	keypair: BoxKeyPair | null = null;

	onPasswordRequest: ((reason: string) => Promise<string | null>) | null = null;

	constructor(
		readonly address: string,
		data:
			| { isEncrypted: false; keydata: Uint8Array }
			| { isEncrypted: true; keydata: Uint8Array; publicKey: Uint8Array },
	) {
		this.isEncrypted = data.isEncrypted;
		this.keydata = data.keydata;
		if (!data.isEncrypted) {
			this.keypair = nacl.box.keyPair.fromSecretKey(data.keydata);
			this.publicKey = this.keypair.publicKey;
		} else {
			this.publicKey = data.publicKey;
		}
	}

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

	toBytes(): Uint8Array {
		const addressBuffer = SmartBuffer.ofUTF8String(this.address).bytes;

		const buf = SmartBuffer.ofSize(1 + addressBuffer.length + 1 + 1 + 32 + this.keydata.length);
		buf.writeBytes8Length(addressBuffer);
		buf.writeBytes(this.publicKey);
		buf.writeUint8(this.isEncrypted ? 1 : 0);
		buf.writeBytes8Length(this.keydata);

		return buf.bytes;
	}

	static getMagicString(address: string, keyIndex: number, password: string) {
		return `$ylide${address}${keyIndex}${password}ylide$`;
	}

	static encryptKeyByPassword(key: Uint8Array, password: string) {
		return symmetricEncrypt(key, sha256(password));
	}

	static decryptKeyByPassword(keydata: Uint8Array, password: string) {
		return symmetricDecrypt(keydata, sha256(password));
	}

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

	private async getDecryptedKey(password: string) {
		if (!this.isEncrypted) {
			return this.keydata;
		}

		return YlideKeyPair.decryptKeyByPassword(this.keydata, password);
	}

	async storeUnencrypted(password: string) {
		if (!this.isEncrypted) {
			return;
		}
		this.keypair = nacl.box.keyPair.fromSecretKey(await this.getDecryptedKey(password));
		this.keydata = this.keypair.secretKey;
		this.isEncrypted = false;
	}

	async storeEncrypted(password: string) {
		if (this.isEncrypted) {
			return;
		}
		this.keydata = YlideKeyPair.encryptKeyByPassword(this.keypair!.secretKey, password);
		this.keypair = null;
		this.isEncrypted = true;
	}

	async decrypt(reason: string): Promise<YlideUnencryptedKeyPair> {
		if (this.isEncrypted) {
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

	async execute(reason: string, processor: (keypair: YlideUnencryptedKeyPair) => Promise<void>) {
		const keypair = await this.decrypt(reason);
		await processor(keypair);
	}
}
