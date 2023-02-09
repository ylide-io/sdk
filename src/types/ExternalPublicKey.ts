import { PublicKey } from './PublicKey';

export interface ExternalYlidePublicKey {
	keyVersion: YlidePublicKeyVersion;
	publicKey: PublicKey;
	timestamp: number;
	registrar: number;
}

export enum YlidePublicKeyVersion {
	INSECURE_KEY_V1 = 1,
	KEY_V2 = 2,
}
