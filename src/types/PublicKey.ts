import SmartBuffer from '@ylide/smart-buffer';
import { PublicKeyType } from './PublicKeyType';

export class PublicKey {
	constructor(public readonly type: PublicKeyType, public readonly bytes: Uint8Array) {}

	static fromHexString(type: PublicKeyType, hex: string) {
		return new PublicKey(type, SmartBuffer.ofHexString(hex).bytes);
	}

	static fromBase64(type: PublicKeyType, base64: string) {
		return new PublicKey(type, SmartBuffer.ofBase64String(base64).bytes);
	}

	static fromBytes(type: PublicKeyType, bytes: Uint8Array) {
		return new PublicKey(type, bytes);
	}

	static fromPackedBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		const type = buf.readUint8();
		const keyBytes = buf.readBytes16Length();
		return new PublicKey(type, keyBytes);
	}

	static fromPackedBytesInBuffer(buf: SmartBuffer) {
		const version = buf.readUint8();
		const type = buf.readUint8();
		const keyBytes = buf.readBytes16Length();
		return new PublicKey(type, keyBytes);
	}

	toHex() {
		return new SmartBuffer(this.bytes).toHexString();
	}

	toBase64() {
		return new SmartBuffer(this.bytes).toBase64String();
	}

	getPackedSize() {
		return 1 + 1 + 2 + this.bytes.length;
	}

	toPackedBytes() {
		const buf = SmartBuffer.ofSize(this.getPackedSize());
		this.toPackedBytesInBuffer(buf);
		return buf.bytes;
	}

	toPackedBytesInBuffer(buf: SmartBuffer) {
		buf.writeUint8(1);
		buf.writeUint8(this.type);
		buf.writeBytes16Length(this.bytes);
	}

	equals(b: PublicKey) {
		return (
			b.type === this.type && b.bytes.length === this.bytes.length && b.bytes.every((v, i) => this.bytes[i] === v)
		);
	}
}
