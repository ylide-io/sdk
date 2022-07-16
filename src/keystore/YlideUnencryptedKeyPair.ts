import { BoxKeyPair } from 'tweetnacl';
import { asymmetricDecrypt, asymmetricEncrypt } from '../crypto';

export class YlideUnencryptedKeyPair {
	constructor(private readonly keypair: BoxKeyPair) {
		//
	}

	get publicKey(): Uint8Array {
		return this.keypair.publicKey;
	}

	encrypt(data: Uint8Array, theirPublicKey: Uint8Array) {
		return asymmetricEncrypt(data, this.keypair.secretKey, theirPublicKey);
	}

	decrypt(data: Uint8Array, theirPublicKey: Uint8Array) {
		return asymmetricDecrypt(data, this.keypair.secretKey, theirPublicKey);
	}
}
