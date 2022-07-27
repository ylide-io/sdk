import { PublicKey } from './PublicKey';

export interface IExtraEncryptionStrateryEntry {
	ylide: false;
	blockchain: string;
	address: string;
	type: string;
	data: any;
}

export interface IExtraEncryptionStrateryBulk {
	addedPublicKey?: { key: PublicKey };
	blockchain: string;
	type: string;
	data: any;
}
