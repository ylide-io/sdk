import nacl, { BoxKeyPair } from 'tweetnacl';
import SmartBuffer from '@ylide/smart-buffer';

export class SessionKey {
	private signedPublicKey: Uint8Array | null = null;

	static generateKeyPair(): BoxKeyPair {
		return nacl.box.keyPair();
	}

	static async signPublicKey(publicKey: Uint8Array, signer: (key: Uint8Array) => Promise<Uint8Array>) {
		return await signer(publicKey);
	}

	static encryptData(data: Uint8Array, recipientPublicKey: Uint8Array, keys: BoxKeyPair) {
		const nonce = nacl.randomBytes(24);
		return {
			encryptedData: nacl.box(data, nonce, recipientPublicKey, keys.secretKey),
			nonce,
		};
	}

	static packDataNonce(data: Uint8Array, nonce: Uint8Array) {
		const buf = SmartBuffer.ofSize(2 + data.length + nonce.length);
		buf.writeBytes8Length(data);
		buf.writeBytes8Length(nonce);
		return buf.bytes;
	}

	static unpackDataNonce(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		return {
			data: buf.readBytes8Length(),
			nonce: buf.readBytes8Length(),
		};
	}

	static verifySessionKey(
		sessionPublicKey: Uint8Array,
		sessionPublicKeySign: Uint8Array,
		senderPublicKey: Uint8Array,
	) {
		return nacl.sign.detached.verify(sessionPublicKey, sessionPublicKeySign, senderPublicKey);
	}

	static packSessionKey(sessionPublicKey: Uint8Array, sessionPublicKeySign: Uint8Array) {
		const buf = SmartBuffer.ofSize(2 + sessionPublicKey.length + sessionPublicKeySign.length);
		buf.writeBytes8Length(sessionPublicKey);
		buf.writeBytes8Length(sessionPublicKeySign);
		return buf.bytes;
	}

	static unpackSessionKey(buf: SmartBuffer) {
		const sessionPublicKey = buf.readBytes8Length();
		const sessionPublicKeySign = buf.readBytes8Length();
		return {
			sessionPublicKey,
			sessionPublicKeySign,
		};
	}
}
