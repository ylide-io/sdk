import { BoxKeyPair } from 'tweetnacl';
import { asymmetricDecrypt, asymmetricEncrypt } from '../crypto';

/**
 * @category Keys
 * @description Class to represent unencrypted communication key which could be used to decrypt/encrypt message content
 */
export class YlideUnencryptedKeyPair {
	constructor(private readonly keypair: BoxKeyPair) {
		//
	}

	get publicKey(): Uint8Array {
		return this.keypair.publicKey;
	}

	/**
	 * Method to encrypt some data for a certain recipient
	 * @param data Data to encrypt
	 * @param theirPublicKey Recipient's public key
	 * @returns Encrypted bytes
	 */
	encrypt(data: Uint8Array, theirPublicKey: Uint8Array) {
		return asymmetricEncrypt(data, this.keypair.secretKey, theirPublicKey);
	}

	/**
	 * Method to decrypt data sent from a certain sender
	 * @param data Encrypted data
	 * @param theirPublicKey Sender's public key
	 * @returns Decrypted data
	 */
	decrypt(data: Uint8Array, theirPublicKey: Uint8Array) {
		return asymmetricDecrypt(data, this.keypair.secretKey, theirPublicKey);
	}
}
