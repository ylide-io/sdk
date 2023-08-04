import type { EncryptionPublicKey } from './EncryptionPublicKey';

export interface IExtraEncryptionStrateryEntry {
	ylide: false;
	blockchain: string;
	address: string;
	type: string;
	data: any;
}

export interface IExtraEncryptionStrateryBulk {
	addedPublicKey?: { key: EncryptionPublicKey };
	blockchain: string;
	type: string;
	data: any;
}
