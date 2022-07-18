import SmartBuffer from '@ylide/smart-buffer';
import nacl from 'tweetnacl';

/**
 * @category Crypto
 * @description Method to asymmetrically encrypt the data using *x25519-xsalsa20-poly1305* algorithm.
 *
 * @param data Data to encrypt
 * @param mySecretKey My private key
 * @param theirPublicKey Recipient's public key
 * @returns Encrypted data
 */
export function asymmetricEncrypt(data: Uint8Array, mySecretKey: Uint8Array, theirPublicKey: Uint8Array) {
	const nonce = nacl.randomBytes(24);
	const encData = nacl.box(data, nonce, theirPublicKey, mySecretKey);
	const buf = SmartBuffer.ofSize(nonce.length + 4 + encData.length);
	buf.writeBytes(nonce);
	buf.writeBytes32Length(encData);
	return buf.bytes;
}

/**
 * @category Crypto
 * @description Method to asymmetrically decrypt the data using *x25519-xsalsa20-poly1305* algorithm.
 *
 * @param data Data to decrypt
 * @param mySecretKey My private key
 * @param theirPublicKey Sender's public key
 * @returns Decrypted data
 */
export function asymmetricDecrypt(data: Uint8Array, mySecretKey: Uint8Array, theirPublicKey: Uint8Array) {
	const buf = new SmartBuffer(data);

	const nonce = buf.readBytes(24);
	const encData = buf.readBytes32Length();

	const decData = nacl.box.open(encData, nonce, theirPublicKey, mySecretKey);
	if (!decData) {
		throw new Error('Invalid box or key');
	}
	return decData;
}
