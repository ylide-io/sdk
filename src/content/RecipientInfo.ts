/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SmartBuffer } from '@ylide/smart-buffer';

export interface IRecipientInfo {
	// resolved address of the recipient that was used to retrieve the key to encrypt the message
	address: string;
	// blockchain from which the Ylide public key was retrieved
	blockchain: string;
	// optional alias data, example: {type: 'ENS', data: 'mydomain.eth'}, {type: 'gnosis-safe', data: '0x123...'}
	// this alias was used to retrieve actual address of the recipient
	alias?: { type: string; data: any };
}

export class RecipientInfo implements IRecipientInfo {
	address: string;
	blockchain: string;
	alias?: { type: string; data: any };

	constructor(data: IRecipientInfo) {
		this.address = data.address;
		this.blockchain = data.blockchain;
		this.alias = data.alias;
	}

	toBytes(): Uint8Array {
		const addressBytes = new TextEncoder().encode(this.address);
		const blockchainBytes = new TextEncoder().encode(this.blockchain);
		const isThereAlias = !!this.alias;
		let aliasLength = 0;
		let aliasTypeBytes: Uint8Array;
		let aliasDataBytes: Uint8Array;
		if (this.alias) {
			aliasTypeBytes = new TextEncoder().encode(this.alias.type);
			aliasDataBytes = new TextEncoder().encode(this.alias.data);
			aliasLength =
				1 + // alias type length
				aliasTypeBytes.length + // alias type
				2 + // alias data length
				aliasDataBytes.length; // alias data
		}
		const buf = SmartBuffer.ofSize(
			2 + // address length
				addressBytes.length + // address
				1 + // blockchain length
				blockchainBytes.length + // blockchain
				1 + // is there alias length
				aliasLength,
		);
		buf.writeBytes16Length(addressBytes);
		buf.writeBytes8Length(blockchainBytes);
		buf.writeUint8(isThereAlias ? 1 : 0);
		if (isThereAlias) {
			buf.writeBytes8Length(aliasTypeBytes!);
			buf.writeBytes16Length(aliasDataBytes!);
		}
		return buf.bytes;
	}

	static fromBytes(bytes: Uint8Array): RecipientInfo {
		const buf = new SmartBuffer(bytes);
		const address = new TextDecoder().decode(buf.readBytes16Length());
		const blockchain = new TextDecoder().decode(buf.readBytes8Length());
		const isThereAlias = buf.readUint8() === 1;
		if (isThereAlias) {
			const aliasType = new TextDecoder().decode(buf.readBytes8Length());
			const aliasData = new TextDecoder().decode(buf.readBytes16Length());
			return new RecipientInfo({ address, blockchain, alias: { type: aliasType, data: aliasData } });
		} else {
			return new RecipientInfo({ address, blockchain });
		}
	}
}
