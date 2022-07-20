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
	return packSymmetricalyEncryptedData(encData, nonce);
}

/**
 * Method to pack data and nonce into one readable bytes array
 * @param encData Encrypted data raw bytes
 * @param nonce Nonce raw bytes
 * @returns Container buffer
 */
export function packSymmetricalyEncryptedData(encData: Uint8Array, nonce: Uint8Array) {
	const buf = SmartBuffer.ofSize(1 + 1 + nonce.length + 4 + encData.length);
	buf.writeUint8(1);
	buf.writeBytes8Length(nonce);
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
	const { nonce, encData } = unpackSymmetricalyEncryptedData(data);

	const decData = nacl.box.open.after(encData, nonce, key);
	if (!decData) {
		throw new Error('Invalid box or key');
	}
	return decData;
}

/**
 * Method to unpack data and nonce from one readable bytes array
 * @param data Bytes with encrypted data and nonce
 * @returns Data and nonce
 */
export function unpackSymmetricalyEncryptedData(data: Uint8Array) {
	const buf = new SmartBuffer(data);

	const version = buf.readUint8();
	const nonce = buf.readBytes8Length();
	const encData = buf.readBytes32Length();

	return {
		nonce,
		encData,
	};
}
