import SmartBuffer from '@ylide/smart-buffer';

export class MessageKey {
	constructor(
		public readonly publicKeyIndex: number,
		public readonly decryptingPublicKeySignature: number | undefined,
		public readonly encryptedMessageKey: Uint8Array,
	) {}

	toBytes() {
		const buf = SmartBuffer.ofSize(1 + 1 + 4 + 2 + this.encryptedMessageKey.length);
		buf.writeUint8(0x02); // version
		buf.writeUint8(this.publicKeyIndex);
		if (this.decryptingPublicKeySignature === undefined) {
			throw new Error('Decrypting public key signature is not provided');
		}
		buf.writeUint32(this.decryptingPublicKeySignature);
		buf.writeBytes16Length(this.encryptedMessageKey);
		return buf.bytes;
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version === 0x01) {
			const publicKeyIndex = buf.readUint8();
			const encryptedMessageKey = buf.readBytes16Length();
			return new MessageKey(publicKeyIndex, undefined, encryptedMessageKey);
		} else if (version === 0x02) {
			const publicKeyIndex = buf.readUint8();
			const decryptingPublicKeySignature = buf.readUint32();
			const encryptedMessageKey = buf.readBytes16Length();
			return new MessageKey(publicKeyIndex, decryptingPublicKeySignature, encryptedMessageKey);
		} else {
			throw new Error('Unsupported key version');
		}
	}
}
