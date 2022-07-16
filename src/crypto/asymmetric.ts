import SmartBuffer from '@ylide/smart-buffer';
import nacl, { BoxKeyPair } from 'tweetnacl';

export function asymmetricEncrypt(data: Uint8Array, mySecretKey: Uint8Array, theirPublicKey: Uint8Array) {
	const nonce = nacl.randomBytes(24);
	const encData = nacl.box(data, nonce, theirPublicKey, mySecretKey);
	const buf = SmartBuffer.ofSize(nonce.length + 4 + encData.length);
	buf.writeBytes(nonce);
	buf.writeBytes32Length(encData);
	return buf.bytes;
}

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
