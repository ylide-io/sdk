import { EncryptionPublicKey } from './EncryptionPublicKey';

import { sha256 } from '../crypto/sha256';
import { Serializable } from '../serialize';

import { DynamicSmartBuffer, SmartBuffer } from '@ylide/smart-buffer';

import type { YlideKeyVersion } from './YlideKeyVersion';
import type { PublicKeyType } from './PublicKeyType';

export class PublicKey extends Serializable<PublicKey>() {
	private readonly _signature: number;

	constructor(
		public readonly type: PublicKeyType,
		public readonly keyVersion: YlideKeyVersion,
		public readonly keyBytes: Uint8Array,
	) {
		super();
		this._signature = new Uint32Array(sha256(this.keyBytes).slice(0, 4).buffer)[0];
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const containerVersion = buf.readUint8();
		const type = buf.readUint8();
		const keyVersion = buf.readUint8() as YlideKeyVersion;
		const keyBytes = buf.readBytes8Length();
		return new PublicKey(type, keyVersion, keyBytes);
	}

	toBytes() {
		const buf = new DynamicSmartBuffer();
		buf.writeUint8(1);
		buf.writeUint8(this.type);
		buf.writeUint8(this.keyVersion);
		buf.writeBytes8Length(this.keyBytes);
		return buf.bytes;
	}

	get signature(): number {
		return this._signature;
	}

	get encryptionPublicKey() {
		return new EncryptionPublicKey(this.type, this.keyBytes);
	}

	equals(b: PublicKey) {
		return (
			b.type === this.type &&
			b.keyVersion === this.keyVersion &&
			b.keyBytes.length === this.keyBytes.length &&
			b.keyBytes.every((v, i) => this.keyBytes[i] === v)
		);
	}

	keyEquals(b: Uint8Array) {
		return b.length === this.keyBytes.length && b.every((v, i) => this.keyBytes[i] === v);
	}
}
