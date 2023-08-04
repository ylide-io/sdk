import { Serializable } from '../serialize';
import { safeJsonParse } from '../utils/safeJsonParse';

import { DynamicSmartBuffer, SmartBuffer } from '@ylide/smart-buffer';

export class WalletAccount<Meta = any> extends Serializable<WalletAccount>() {
	constructor(
		public readonly blockchainGroup: string,
		public readonly wallet: string,
		public readonly address: string,
		public readonly $$meta: Meta,
	) {
		super();
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);

		const blockchainGroup = buf.readString8Length();
		const wallet = buf.readString8Length();
		const address = buf.readString8Length();

		const $$meta = safeJsonParse(buf.readString16Length(), null);

		return new WalletAccount(blockchainGroup, wallet, address, $$meta);
	}

	toBytes() {
		const buf = new DynamicSmartBuffer();

		buf.writeString8Length(this.blockchainGroup);
		buf.writeString8Length(this.wallet);
		buf.writeString8Length(this.address);

		buf.writeString16Length(JSON.stringify(this.$$meta));

		return buf.bytes;
	}
}
