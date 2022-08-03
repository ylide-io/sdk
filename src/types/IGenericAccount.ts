import { PublicKey } from './PublicKey';

/**
 * Interface representing generic blockchain account
 */
export interface IGenericAccount {
	blockchain: string;
	address: string;
	publicKey: PublicKey | null;
}
