import { AbstractBlockchainController, BlockchainControllerFactory, WalletControllerFactory } from './abstracts';
import { AbstractWalletController } from './abstracts/AbstractWalletController';
import { MessageContainer, MessageContent, MessageEncodedContent, MessageKey } from './content';
import { DynamicEncryptionRouter } from './cross-chain/DynamicEncryptionRouter';
import { sha256 } from './crypto';
import { YlideKeyStore } from './keystore';
import { IGenericAccount, IMessage, IMessageContent, PublicKeyType, ServiceCode } from './types';
import { uint8ArrayToUint256 } from './types/Uint256';

export * from './types';
export * from './abstracts';
export * from './storage';
export * from './keystore';
export * from './crypto';
export * from './content';
// export * from './fetch';

export type WalletMap<T> = Record<string, T>;
export type BlockchainMap<T> = Record<string, T>;
export type BlockchainWalletMap<T> = BlockchainMap<WalletMap<T>>;

/**
 * @description It's a singleton entry point to all interactions with Ylide SDK
 * @example
 * ```ts
 * import { Ylide } from '@ylide/sdk';
 * import { everscaleBlockchainFactory, everscaleWalletFactory } from '@ylide/everscale';
 *
 * Ylide.registerBlockchain(everscaleBlockchainFactory);
 * Ylide.registerWallet(everscaleWalletFactory);
 *
 * const wallet = await Ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
 *
 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
 * ```
 */
export class Ylide {
	private static _walletFactories: BlockchainWalletMap<WalletControllerFactory> = {};
	private static _blockchainFactories: BlockchainMap<BlockchainControllerFactory> = {};

	/**
	 * Use this method to register all available blockchain wallets to Ylide.
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { everscaleWalletFactory } from '@ylide/everscale';
	 *
	 * Ylide.registerWallet(everscaleWalletFactory);
	 * ```
	 * @param factory Wallet controller factory which you want to register
	 */
	static registerWalletFactory(factory: WalletControllerFactory) {
		this._walletFactories[factory.blockchain] = {
			...this._walletFactories[factory.blockchain],
			[factory.wallet]: factory,
		};
	}

	/**
	 * Use this method to register all available blockchain blockchains to Ylide.
	 * @example
	 * ```ts
	 * import { Ylide } from '@ylide/sdk';
	 * import { everscaleBlockchainFactory } from '@ylide/everscale';
	 *
	 * Ylide.registerBlockchain(everscaleBlockchainFactory);
	 * ```
	 * @param factory Blockchain controller factory which you want to register
	 */
	static registerBlockchainFactory(factory: BlockchainControllerFactory) {
		this._blockchainFactories[factory.blockchain] = factory;
	}

	/**
	 * Method to check availability of a certain blockchain for reading messages
	 * @example
	 * ```ts
	 * Ylide.isBlockchainRegistered('everscale'); // return true if `Ylide.registerBlockchain` was called with this blockchain controller factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isBlockchainRegistered(blockchain: string) {
		return !!this._blockchainFactories[blockchain];
	}

	/**
	 * Method to check availability of a certain blockchain for sending messages
	 * @example
	 * ```ts
	 * Ylide.isWalletRegistered('everscale', 'everwallet'); // return true if `Ylide.registerWallet` was called with this wallet factory before
	 * ```
	 * @param blockchain Name of blockchain you want to check
	 */
	static isWalletRegistered(blockchain: string, wallet: string) {
		return !!(this._walletFactories[blockchain] && this._walletFactories[blockchain][wallet]);
	}

	/**
	 * Method to get blockchain controller factory for a certain blockchain
	 * @param blockchain Name of blockchain
	 */
	static getBlockchainControllerFactory(blockchain: string) {
		return this._blockchainFactories[blockchain];
	}

	/**
	 * Method to get wallet controller factory for a certain blockchain and wallet type
	 * @param blockchain Name of blockchain
	 * @param wallet Name of in-browser wallet
	 */
	static getWalletControllerFactory(blockchain: string, wallet: string) {
		return this._walletFactories[blockchain][wallet];
	}

	/**
	 * Method to get registered wallet controllers
	 * @example
	 * ```ts
	 * const ethereumWallets = Ylide.walletsList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get walletsList() {
		return Object.keys(this._walletFactories)
			.map(blockchain =>
				Object.keys(this._walletFactories[blockchain]).map(wallet => ({
					blockchain,
					wallet,
					factory: this._walletFactories[blockchain][wallet],
				})),
			)
			.flat();
	}

	/**
	 * Method to get registered blockchain controllers
	 * @example
	 * ```ts
	 * const ethereumChains = Ylide.blockchainsList.filter(t => t.blockchain === 'ethereum');
	 * ```
	 */
	static get blockchainsList() {
		return Object.keys(this._blockchainFactories).map(blockchain => ({
			blockchain,
			factory: this._blockchainFactories[blockchain],
		}));
	}

	/**
	 * Method to get a list of registered wallet controllers that are available in the user's browser (wallets installed)
	 * @example
	 * ```ts
	 * const availableWallets = await Ylide.getAvailableWallets();
	 * ```
	 */
	static async getAvailableWallets(): Promise<WalletControllerFactory[]> {
		const list = this.walletsList;

		const result: WalletControllerFactory[] = [];

		for (const sender of list) {
			try {
				if (await sender.factory.isWalletAvailable()) {
					result.push(sender.factory);
				}
			} catch (e) {
				//
			}
		}

		return result;
	}

	/**
	 * Method to get a list of registered blockchain controllers
	 * @example
	 * ```ts
	 * const availableBlockchains = await Ylide.getAvailableBlockchains();
	 * ```
	 */
	static async getAvailableBlockchains(): Promise<BlockchainControllerFactory[]> {
		return this.blockchainsList.map(r => r.factory);
	}

	/**
	 * Method to instantiate both wallet and blockchain controllers with the same options
	 * @example
	 * ```ts
	 * const wallet = await Ylide.instantiateWallet('everscale', 'everwallet', { dev: false });
	 *
	 * const isMyAddressValid = wallet.blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static async instantiateWallet(
		blockchain: string,
		wallet: string,
		options?: any,
		blockchainController?: AbstractBlockchainController,
	) {
		const blockchainControllerFactory = this.getBlockchainControllerFactory(blockchain);
		const walletControllerFactory = this.getWalletControllerFactory(blockchain, wallet);
		if (!(await walletControllerFactory.isWalletAvailable())) {
			throw new Error('Wallet is not available');
		}
		blockchainController = blockchainController || blockchainControllerFactory.create(options);
		const walletController = walletControllerFactory.create(blockchainController, options);
		return { blockchainController, walletController };
	}

	/**
	 * Method to instantiate blockchain controller
	 * @example
	 * ```ts
	 * const blockchainController = await Ylide.instantiateBlockchain('everscale', { dev: false });
	 *
	 * const isMyAddressValid = blockchainController.isAddressValid('0:81f452f5aec2263ab10116f7108a20209d5051081bb3caed34f139f976a0e279');
	 * ```
	 */
	static instantiateBlockchain(blockchain: string, options?: any) {
		const blockchainControllerFactory = this.getBlockchainControllerFactory(blockchain);
		return blockchainControllerFactory.create(options);
	}

	// non-singleton part starts here:

	readonly blockchains: AbstractBlockchainController[] = [];
	readonly blockchainsMap: BlockchainMap<AbstractBlockchainController> = {};
	readonly wallets: AbstractWalletController[] = [];
	readonly walletsMap: BlockchainWalletMap<AbstractWalletController> = {};

	constructor(public readonly keystore: YlideKeyStore) {
		//
	}

	async addBlockchain(blockchain: string, options?: any) {
		if (this.blockchainsMap[blockchain]) {
			throw new Error('For now we support only one blockchain reader per blockchain per instance');
		}
		const ctrl = await Ylide.instantiateBlockchain(blockchain, options);
		this.blockchainsMap[blockchain] = ctrl;
		this.blockchains.push(ctrl);
		return ctrl;
	}

	async addWallet(blockchain: string, wallet: string, options?: any) {
		if (this.walletsMap[blockchain] && this.walletsMap[blockchain][wallet]) {
			throw new Error('For now we support only one wallet writer per blockchain per instance');
		}
		const ctrl = await Ylide.instantiateWallet(blockchain, wallet, options, this.blockchainsMap[blockchain]);
		if (!this.blockchainsMap[blockchain]) {
			this.blockchainsMap[blockchain] = ctrl.blockchainController;
			this.blockchains.push(ctrl.blockchainController);
		}
		this.walletsMap[blockchain] = {
			...(this.walletsMap[blockchain] || {}),
			[wallet]: ctrl.walletController,
		};
		this.wallets.push(ctrl.walletController);
		return ctrl;
	}

	async sendMessage({
		wallet,
		sender,
		content,
		recipients,
		serviceCode = ServiceCode.SDK,
		copyOfSent = true,
	}: SendMessageArgs) {
		console.log('ddd');
		const { encodedContent, key } = MessageEncodedContent.encodeContent(content);
		const actualRecipients = recipients.map(r => {
			const bc = this.blockchains.find(b => b.isAddressValid(r));
			if (!bc) {
				throw new Error(`Address ${r} is not valid for any registered blockchain`);
			}
			return {
				keyAddress: bc.addressToUint256(r),
				keyAddressOriginal: r,
				address: bc.addressToUint256(r),
				blockchain: bc,
			};
		});
		console.log('bien');
		if (copyOfSent) {
			actualRecipients.push({
				keyAddress: wallet.blockchainController.addressToUint256(sender.address),
				keyAddressOriginal: sender.address,
				address: uint8ArrayToUint256(sha256(sender.address)),
				blockchain: wallet.blockchainController,
			});
		}
		console.log('locs');
		const route = await DynamicEncryptionRouter.findEncyptionRoute(actualRecipients, this.blockchains);
		console.log('gon');
		const { publicKeys, processedRecipients } = await DynamicEncryptionRouter.executeEncryption(route, key);
		const container = MessageContainer.packContainer(serviceCode, publicKeys, encodedContent);
		console.log('yac');
		return wallet.publishMessage(sender, container, processedRecipients);
	}

	async decryptMessageContent(msg: IMessage, content: IMessageContent, receipientKeyAddress?: string) {
		if (!receipientKeyAddress) {
			receipientKeyAddress = msg.recipientAddress;
		}
		const unpackedContent = await MessageContainer.unpackContainter(content.content);
		const msgKey = MessageKey.fromBytes(msg.key);
		const publicKey = unpackedContent.senderPublicKeys[msgKey.publicKeyIndex];
		const walletAccounts = await Promise.all(
			this.wallets.map(async w => ({ wallet: w, account: await w.getAuthenticatedAccount() })),
		);
		const accountIdx = walletAccounts.findIndex(a => a.account && a.account.address === receipientKeyAddress);
		if (accountIdx === -1) {
			throw new Error(`Wallet of this message recipient ${receipientKeyAddress} is not registered`);
		}
		const account = walletAccounts[accountIdx].account!;
		const wallet = walletAccounts[accountIdx].wallet;
		let symmKey: Uint8Array | null = null;
		if (publicKey.type === PublicKeyType.YLIDE) {
			const ylideKey = this.keystore.get(account.address);
			if (!ylideKey) {
				throw new Error('Key of this message recipient is not derived');
			}
			await ylideKey.execute('read mail', async keypair => {
				symmKey = keypair.decrypt(msgKey.encryptedMessageKey, publicKey.bytes);
			});
		} else {
			symmKey = await wallet.decryptMessageKey(publicKey, account, msgKey.encryptedMessageKey);
		}
		if (!symmKey) {
			throw new Error('Unable to find decryption route');
		}
		const decryptedContent = MessageEncodedContent.decodeRawContent(unpackedContent.content, symmKey);
		const decodedContent = MessageEncodedContent.messageContentFromBytes(decryptedContent);
		return {
			...decodedContent,
			serviceCode: unpackedContent.serviceCode,
			decryptedContent,
		};
	}
}

export interface SendMessageArgs {
	wallet: AbstractWalletController;
	sender: IGenericAccount;
	content: MessageContent;
	recipients: string[];
	serviceCode?: number;
	copyOfSent?: boolean;
}
