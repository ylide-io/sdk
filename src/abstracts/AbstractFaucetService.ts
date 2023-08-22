import type { PublicKey, WalletAccount } from '../primitives';

export class DontAccessThisObjectDirectly {
	private constructor() {
		//
	}
}

export abstract class AbstractFaucetService {
	/**
	 * Method to authorize publishing of a public key - usually it will trigger signature request in user's wallet
	 *
	 * @param account - account for which you request authorization
	 * @param key - public key to authorize for sending
	 * @param registrar - registrar code (e.g. 1 for Ylide Social Hub)
	 * @param apiKey - Your API key for the faucet (can be skipped if it was provided in other place)
	 */
	abstract authorizePublishing(
		account: WalletAccount,
		key: PublicKey,
		registrar?: number,
		apiKey?: { type: 'server' | 'client'; key: string },
	): Promise<DontAccessThisObjectDirectly>;

	/**
	 * Method to gaslessly attach public key to the user's address using faucet.
	 *
	 * @param authorizationData - authorization data received from authorizePublishing
	 */
	abstract attachPublicKey(authorizationData: DontAccessThisObjectDirectly): Promise<{ txHash: string }>;
}
