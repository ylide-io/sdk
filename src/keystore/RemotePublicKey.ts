import { PublicKey } from '../primitives/PublicKey';
import { Serializable } from '../serialize';

import { DynamicSmartBuffer, SmartBuffer } from '@ylide/smart-buffer';

export class RemotePublicKey extends Serializable<RemotePublicKey>() {
	constructor(
		public readonly blockchainGroup: string,
		public readonly blockchain: string,
		public readonly address: string,
		public readonly publicKey: PublicKey,
		public readonly timestamp: number,
		public readonly registrar: number,
	) {
		super();
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);

		const blockchainGroup = buf.readString8Length();
		const blockchain = buf.readString8Length();
		const address = buf.readString8Length();

		const publicKeyBytes = buf.readBytes8Length();
		const publicKey = PublicKey.fromBytes(publicKeyBytes);

		const timestamp = buf.readUint32();
		const registrar = buf.readUint32();

		return new RemotePublicKey(blockchainGroup, blockchain, address, publicKey, timestamp, registrar);
	}

	toBytes() {
		const buf = new DynamicSmartBuffer();

		buf.writeString8Length(this.blockchainGroup);
		buf.writeString8Length(this.blockchain);
		buf.writeString8Length(this.address);

		buf.writeBytes8Length(this.publicKey.toBytes());

		buf.writeUint32(this.timestamp);
		buf.writeUint32(this.registrar);

		return buf.bytes;
	}

	get signature() {
		return this.publicKey.signature;
	}
}
