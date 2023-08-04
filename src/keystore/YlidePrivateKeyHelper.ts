import { sha256 } from '../crypto/sha256';
import { symmetricDecrypt, symmetricEncrypt } from '../crypto/symmetric';

import { SmartBuffer } from '@ylide/smart-buffer';

export class YlidePrivateKeyHelper {
	/**
	 * Method to generate dynamic magic string for signing
	 *
	 * @see [Initialization of communication keys](https://ylide-io.github.io/sdk/handbook/basics#keys-init)
	 * @param address User's address
	 * @param keyIndex Index of this key
	 * @param password Ylide password
	 * @returns String to be signed using user's wallet
	 */
	static getMagicStringV3(address: string, keyIndex: number) {
		const magicString = new SmartBuffer(
			sha256(sha256(sha256(sha256(sha256(sha256(sha256(`$ylide${address}${keyIndex}${'no-password'}ylide$`))))))),
		).toBase64String();
		return `I authorize this app to decrypt my messages in the Ylide Protocol for the following address: ${address}.\n\nI understand that if I provide my Ylide Password and this signature to any malicious app, the attacker would be able to read my messages.\n\nThis is not a transaction, and confirmation doesn’t cost you anything.\n\nNonce: ${magicString}`;
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
	static getMagicStringV2(address: string, keyIndex: number, password: string) {
		const magicString = new SmartBuffer(
			sha256(sha256(sha256(sha256(sha256(sha256(sha256(`$ylide${address}${keyIndex}${password}ylide$`))))))),
		).toBase64String();
		return `I authorize this app to decrypt my messages in the Ylide Protocol for the following address: ${address}.\n\nI understand that if I provide my Ylide Password and this signature to any malicious app, the attacker would be able to read my messages.\n\nThis is not a transaction, and confirmation doesn’t cost you anything.\n\nNonce: ${magicString}`;
	}

	/**
	 * Method to generate deprecated old unsecure dynamic magic string for signing
	 *
	 * @see [Initialization of communication keys](https://ylide-io.github.io/sdk/handbook/basics#keys-init)
	 * @param address User's address
	 * @param keyIndex Index of this key
	 * @param password Ylide password
	 * @returns String to be signed using user's wallet
	 */
	static getMagicStringV1(address: string, keyIndex: number, password: string) {
		return `$ylide${address}${keyIndex}${password}ylide$`;
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
}
