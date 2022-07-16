import SmartBuffer from '@ylide/smart-buffer';
import nacl, { BoxKeyPair } from 'tweetnacl';

export function symmetricEncrypt(data: Uint8Array, key: Uint8Array) {
	const nonce = nacl.randomBytes(24);
	const encData = nacl.box.after(data, nonce, key);
	const buf = SmartBuffer.ofSize(nonce.length + 4 + encData.length);
	buf.writeBytes(nonce);
	buf.writeBytes32Length(encData);
	return buf.bytes;
}

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
