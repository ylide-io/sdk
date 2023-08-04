import { sha256 } from '../crypto/sha256';

import type { PublicKeyType } from './PublicKeyType';
import type { PublicKey } from './PublicKey';
import type { SmartBuffer } from '@ylide/smart-buffer';

export class EncryptionPublicKey {
	private readonly _signature: number;

	constructor(public readonly type: PublicKeyType, public readonly keyBytes: Uint8Array) {
		this._signature = new Uint32Array(sha256(this.keyBytes).slice(0, 4).buffer)[0];
	}

	get signature(): number {
		return this._signature;
	}

	static fromPackedBytesInBuffer(buf: SmartBuffer) {
		const version = buf.readUint8();
		const type = buf.readUint8();
		const keyBytes = buf.readBytes16Length();
		return new EncryptionPublicKey(type, keyBytes);
	}

	getPackedSize() {
		return 1 + 1 + 2 + this.keyBytes.length;
	}

	toPackedBytesInBuffer(buf: SmartBuffer) {
		buf.writeUint8(1);
		buf.writeUint8(this.type);
		buf.writeBytes16Length(this.keyBytes);
	}

	equals(b: PublicKey) {
		return (
			b.type === this.type &&
			b.keyBytes.length === this.keyBytes.length &&
			b.keyBytes.every((v, i) => this.keyBytes[i] === v)
		);
	}
}
