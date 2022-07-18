import SmartBuffer from '@ylide/smart-buffer';
import nacl from 'tweetnacl';

/**
 * @category Crypto
 * @description Method to symmetrically encrypt the data using *xsalsa20-poly1305* algorithm.
 *
 * @param data Data to encrypt
 * @param key Symmetric key to encrypt the data
 * @returns Encrypted data
 */
export function symmetricEncrypt(data: Uint8Array, key: Uint8Array) {
	const nonce = nacl.randomBytes(24);
	const encData = nacl.box.after(data, nonce, key);
	const buf = SmartBuffer.ofSize(nonce.length + 4 + encData.length);
	buf.writeBytes(nonce);
	buf.writeBytes32Length(encData);
	return buf.bytes;
}

/**
 * @category Crypto
 * @description Method to symmetrically decrypt the data using *xsalsa20-poly1305* algorithm.
 *
 * @param data Data to decrypt
 * @param key Symmetric key to decrypt the data
 * @returns Decrypted data
 */
export function symmetricDecrypt(data: Uint8Array, key: Uint8Array) {
	const buf = new SmartBuffer(data);

	const nonce = buf.readBytes(24);
	const encData = buf.readBytes32Length();

	const decData = nacl.box.open.after(encData, nonce, key);
	if (!decData) {
		throw new Error('Invalid box or key');
	}
	return decData;
}
