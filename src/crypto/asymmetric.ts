import nacl from 'tweetnacl';
import { packSymmetricalyEncryptedData, unpackSymmetricalyEncryptedData } from '.';

/**
 * @category Crypto
 * @description Method to asymmetrically encrypt the data using *x25519-xsalsa20-poly1305* algorithm.
 *
 * @param data Data to encrypt
 * @param mySecretKey My private key
 * @param theirPublicKey Recipient's public key
 * @returns Encrypted data
 */
export const asymmetricEncrypt = (data: Uint8Array, mySecretKey: Uint8Array, theirPublicKey: Uint8Array) => {
	const nonce = nacl.randomBytes(24);
	const encData = nacl.box(data, nonce, theirPublicKey, mySecretKey);
	return packSymmetricalyEncryptedData(encData, nonce);
};

/**
 * @category Crypto
 * @description Method to asymmetrically decrypt the data using *x25519-xsalsa20-poly1305* algorithm.
 *
 * @param data Data to decrypt
 * @param mySecretKey My private key
 * @param theirPublicKey Sender's public key
 * @returns Decrypted data
 */
export const asymmetricDecrypt = (data: Uint8Array, mySecretKey: Uint8Array, theirPublicKey: Uint8Array) => {
	const { nonce, encData } = unpackSymmetricalyEncryptedData(data);

	const decData = nacl.box.open(encData, nonce, theirPublicKey, mySecretKey);
	if (!decData) {
		throw new Error('Invalid box or key');
	}
	return decData;
};
