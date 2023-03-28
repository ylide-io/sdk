import { YlidePublicKeyVersion } from '../types';
import { YlideKeyPair } from './YlideKeyPair';

export class YlideKey {
	constructor(
		public readonly blockchainGroup: string,
		public readonly wallet: string,
		public readonly address: string,
		public readonly keypair: YlideKeyPair,
		public readonly keyVersion: YlidePublicKeyVersion,
	) {
		//
	}

	private _classEnforcer() {
		//
	}
}
