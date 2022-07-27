import SmartBuffer from '@ylide/smart-buffer';

export class MessageKey {
	constructor(public readonly publicKeyIndex: number, public readonly encryptedMessageKey: Uint8Array) {}

	toBytes() {
		const buf = SmartBuffer.ofSize(1 + 1 + 2 + this.encryptedMessageKey.length);
		buf.writeUint8(0x01); // version
		buf.writeUint8(this.publicKeyIndex);
		buf.writeBytes16Length(this.encryptedMessageKey);
		return buf.bytes;
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version !== 0x01) {
			throw new Error('Unsupported key version');
		}
		const publicKeyIndex = buf.readUint8();
		const encryptedMessageKey = buf.readBytes16Length();
		return new MessageKey(publicKeyIndex, encryptedMessageKey);
	}
}
