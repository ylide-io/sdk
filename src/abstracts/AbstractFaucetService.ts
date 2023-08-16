import type { PublicKey, WalletAccount } from '../primitives';

export class DontAccessThisObjectDirectly {
	private constructor() {
		//
	}
}

export abstract class AbstractFaucetService {
	abstract authorizePublishing(
		account: WalletAccount,
		key: PublicKey,
		registrar?: number,
		apiKey?: { type: 'server' | 'client'; key: string },
	): Promise<DontAccessThisObjectDirectly>;

	abstract attachPublicKey(authorizationData: DontAccessThisObjectDirectly): Promise<{ txHash: string }>;
}
