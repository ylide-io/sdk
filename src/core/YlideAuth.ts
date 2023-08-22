import { YlideMisusageError } from '../errors/YlideMisusageError';
import { PrivateKeyAvailabilityState } from '../keystore';
import { YlideKeyVersion } from '../primitives';

import type { Ylide } from '../Ylide';
import type { RemotePublicKey } from '../keystore';
import type { WalletAccount } from '../primitives';

export class YlideAuth {
	constructor(public readonly ylide: Ylide) {
		//
	}

	async isRegistered(account: WalletAccount) {
		const keysMap = await this.ylide.core.getAddressKeys(account.address);
		const keys = Object.keys(keysMap.remoteKeys)
			.map(bc => keysMap.remoteKeys[bc])
			.filter(k => !!k) as RemotePublicKey[];
		await this.ylide.keysRegistry.addRemotePublicKeys(keys);
		return this.ylide.keysRegistry.getRemotePublicKeys(account.address).length > 0;
	}

	async isAuthorized(account: WalletAccount) {
		const localKeys = this.ylide.keysRegistry.getLocalPrivateKeys(account.address);
		return localKeys.filter(k => k.availabilityState !== PrivateKeyAvailabilityState.UNAVAILABLE).length > 0;
	}

	async register(account: WalletAccount) {
		const wallet = this.ylide.controllers.wallets.find(
			w => w.wallet() === account.wallet && w.blockchainGroup() === account.blockchainGroup,
		);
		if (!wallet) {
			throw new YlideMisusageError('YlideAuth', `Wallet ${account.wallet} not found`);
		}
		const privateKey = await this.ylide.keysRegistry.instantiateNewPrivateKey(
			wallet.blockchainGroup(),
			account.address,
			YlideKeyVersion.KEY_V3,
			PrivateKeyAvailabilityState.AVAILABLE,
			{
				onPrivateKeyRequest: (address, magicString) => {
					return wallet.signMagicString(account, magicString);
				},
			},
		);
		await this.ylide.keysRegistry.addLocalPrivateKey(privateKey);
		const blockchain = await wallet.getCurrentBlockchain();
		await wallet.attachPublicKey(account, privateKey.publicKey.keyBytes, privateKey.publicKey.keyVersion, 0);
		const publishedKey = await this.ylide.core.waitForPublicKey(
			blockchain,
			account.address,
			privateKey.publicKey.keyBytes,
		);
		if (publishedKey) {
			await this.ylide.keysRegistry.addRemotePublicKey(publishedKey);
		}
		return publishedKey;
	}

	async login(account: WalletAccount) {
		const wallet = this.ylide.controllers.wallets.find(
			w => w.wallet() === account.wallet && w.blockchainGroup() === account.blockchainGroup,
		);
		if (!wallet) {
			throw new YlideMisusageError('YlideAuth', `Wallet ${account.wallet} not found`);
		}

		let freshestKey = this.ylide.keysRegistry.getFreshestRemotePublicKey(account.address);
		if (!freshestKey) {
			await this.isRegistered(account);
			freshestKey = this.ylide.keysRegistry.getFreshestRemotePublicKey(account.address);
			if (!freshestKey) {
				throw new YlideMisusageError('YlideAuth', `Account ${account.address} is not registered`);
			}
		}
		if (freshestKey.publicKey.keyVersion !== YlideKeyVersion.KEY_V3) {
			throw new YlideMisusageError(
				'YlideAuth',
				`Key version ${freshestKey.publicKey.keyVersion} is not supported by simplified auth. Please, use the docs to implement advanced auth scenario.`,
			);
		}
		const privateKey = await this.ylide.keysRegistry.instantiateNewPrivateKey(
			wallet.blockchainGroup(),
			account.address,
			YlideKeyVersion.KEY_V3,
			PrivateKeyAvailabilityState.AVAILABLE,
			{
				onPrivateKeyRequest: (address, magicString) => {
					return wallet.signMagicString(account, magicString);
				},
			},
		);
		if (!privateKey.publicKey.equals(freshestKey.publicKey)) {
			throw new YlideMisusageError(
				'YlideAuth',
				`Public key mismatch. Probably, user entered wrong password or trying to authorize old key.`,
			);
		}
		await this.ylide.keysRegistry.addLocalPrivateKey(privateKey);
	}
}
