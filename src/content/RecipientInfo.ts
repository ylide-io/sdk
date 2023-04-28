import SmartBuffer from '@ylide/smart-buffer';

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
		let aliasBytes = SmartBuffer.ofSize(0);
		if (this.alias) {
			const aliasTypeBytes = new TextEncoder().encode(this.alias.type);
			const aliasDataBytes = new TextEncoder().encode(this.alias.data);
			aliasBytes = SmartBuffer.ofSize(
				1 + // alias type length
					aliasTypeBytes.length + // alias type
					2 + // alias data length
					aliasDataBytes.length, // alias data
			);
			aliasBytes.writeBytes8Length(aliasTypeBytes);
			aliasBytes.writeBytes16Length(aliasDataBytes);
		}
		const buf = SmartBuffer.ofSize(
			4 + // address length
				addressBytes.length + // address
				4 + // blockchain length
				blockchainBytes.length + // blockchain
				4 + // alias length
				aliasBytes.bytes.length, // alias
		);
		buf.writeBytes32Length(addressBytes);
		buf.writeBytes32Length(blockchainBytes);
		buf.writeBytes32Length(aliasBytes.bytes);
		return buf.bytes;
	}

	static fromBytes(bytes: Uint8Array): RecipientInfo {
		const buf = new SmartBuffer(bytes);
		const address = new TextDecoder().decode(buf.readBytes32Length());
		const blockchain = new TextDecoder().decode(buf.readBytes32Length());
		const aliasBytes = buf.readBytes32Length();
		let alias: { type: string; data: any } | undefined;
		if (aliasBytes.length > 0) {
			const aliasBuf = new SmartBuffer(aliasBytes);
			const aliasType = new TextDecoder().decode(aliasBuf.readBytes8Length());
			const aliasData = new TextDecoder().decode(aliasBuf.readBytes16Length());
			alias = { type: aliasType, data: aliasData };
		}
		return new RecipientInfo({ address, blockchain, alias });
	}
}
