import {
	AbstractBlockchainController,
	AbstractWalletController,
	BlockchainControllerFactory,
	BlockchainSourceType,
	DynamicEncryptionRouter,
	ExternalYlidePublicKey,
	IGenericAccount,
	IListSource,
	IMessage,
	IMessageContent,
	ISourceSubject,
	ListSource,
	MessageContainer,
	MessageContent,
	MessageEncodedContent,
	MessageKey,
	PublicKey,
	PublicKeyType,
	PuppetListSource,
	ServiceCode,
	sha256,
	SourceReadingSession,
	Uint256,
	uint256ToUint8Array,
	uint8ArrayToUint256,
	Ylide,
	YlideKeyStore,
} from '..';
import { IndexerHub } from '../indexer';
import { IndexerMessagesSource } from '../indexer/IndexerMessagesSource';
import { YlideControllers } from './YlideControllers';

export interface SendMessageArgs {
	wallet: AbstractWalletController;
	sender: IGenericAccount;
	content: MessageContent;
	recipients: string[];
	serviceCode?: number;
	copyOfSent?: boolean;
}

export interface BroadcastMessageArgs {
	wallet: AbstractWalletController;
	sender: IGenericAccount;
	content: MessageContent;
	serviceCode?: number;
}

export class YlideCore {
	readonly indexer: IndexerHub;

	constructor(
		public readonly controllers: YlideControllers,
		public readonly keystore: YlideKeyStore,
		private readonly indexerBlockchains: string[] = [],
	) {
		this.indexer = new IndexerHub();
	}

	static getSentAddress(recipient: Uint256): Uint256 {
		return uint8ArrayToUint256(sha256(uint256ToUint8Array(recipient)));
	}

	async getAddressesKeys(addresses: string[]): Promise<
		Record<
			string,
			{
				freshestKey: ExternalYlidePublicKey | null;
				remoteKeys: Record<string, ExternalYlidePublicKey | null>;
			}
		>
	> {
		const blockchains = Ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		let indexerResult: Record<string, Record<string, ExternalYlidePublicKey | null>> = {};

		if (this.indexerBlockchains.length) {
			indexerResult = await this.indexer.retryingOperation(
				async () => {
					const rawResult = await this.indexer.requestMultipleKeys(addresses);
					const result: Record<string, Record<string, ExternalYlidePublicKey | null>> = {};
					for (const address of Object.keys(rawResult)) {
						for (const bc of Object.keys(rawResult[address])) {
							if (!result[address]) {
								result[address] = {};
							}
							const kkey = rawResult[address][bc];
							result[address][bc] = kkey
								? {
										keyVersion: kkey.keyVersion,
										publicKey: PublicKey.fromBytes(PublicKeyType.YLIDE, kkey.publicKey),
										timestamp: kkey.timestamp,
										registrar: kkey.registrar,
								  }
								: null;
						}
					}
					return result;
				},
				async () => {
					return {};
				},
			);
		}

		const toReadFromBlockchain = blockchains.filter(b => !this.indexerBlockchains.includes(b.factory.blockchain));

		const readFromBlockchains = async (
			fromBlockchains: { factory: BlockchainControllerFactory; controller: AbstractBlockchainController }[],
		) => {
			const blockchainRemoteKeys: Record<string, Record<string, ExternalYlidePublicKey | null>> = {};
			await Promise.all(
				addresses.map(async address => {
					const remoteKeys: Record<string, ExternalYlidePublicKey | null> = {};

					await Promise.all(
						fromBlockchains.map(async ({ factory, controller }) => {
							try {
								if (controller.isAddressValid(address)) {
									const key = (await controller.extractPublicKeyFromAddress(address)) || null;
									if (key) {
										remoteKeys[factory.blockchain] = key;
									}
								}
							} catch (err) {
								// so sad :(
							}
						}),
					);

					blockchainRemoteKeys[address] = remoteKeys;
				}),
			);
			return blockchainRemoteKeys;
		};

		const blockchainsResult = await readFromBlockchains(toReadFromBlockchain);

		const globalResult: Record<string, Record<string, ExternalYlidePublicKey | null>> = {};
		// merge results:
		for (const address of addresses) {
			globalResult[address] = {
				...indexerResult[address],
				...blockchainsResult[address],
			};
		}

		const processedResult: Record<
			string,
			{
				freshestKey: ExternalYlidePublicKey | null;
				remoteKeys: Record<string, ExternalYlidePublicKey | null>;
			}
		> = {};
		for (const address of addresses) {
			const remoteKeys = globalResult[address];
			const bcs = Object.keys(remoteKeys);
			let freshestKey: ExternalYlidePublicKey | null = null;
			for (const bc of bcs) {
				const kkey = remoteKeys[bc];
				if (kkey && (!freshestKey || freshestKey.timestamp < kkey.timestamp)) {
					freshestKey = kkey;
				}
			}
			processedResult[address] = {
				freshestKey,
				remoteKeys,
			};
		}

		return processedResult;
	}

	async getAddressKeys(address: string): Promise<{
		freshestKey: ExternalYlidePublicKey | null;
		remoteKeys: Record<string, ExternalYlidePublicKey | null>;
	}> {
		const blockchains = Ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		const toReadFromBlockchain = blockchains.filter(b => !this.indexerBlockchains.includes(b.factory.blockchain));
		const toReadFromIndexer = blockchains.filter(b => this.indexerBlockchains.includes(b.factory.blockchain));

		const readFromBlockchains = async (
			fromBlockchains: { factory: BlockchainControllerFactory; controller: AbstractBlockchainController }[],
		) => {
			const remoteKeys: Record<string, ExternalYlidePublicKey | null> = {};
			await Promise.all(
				fromBlockchains.map(async ({ factory, controller }) => {
					try {
						if (controller.isAddressValid(address)) {
							const key = (await controller.extractPublicKeyFromAddress(address)) || null;
							if (key) {
								remoteKeys[factory.blockchain] = key;
							}
						}
					} catch (err) {
						// so sad :(
					}
				}),
			);
			return remoteKeys;
		};

		const readFromIndexer = async () => {
			const remoteKeys: Record<string, ExternalYlidePublicKey | null> = {};
			const rawRemoteKeys = await this.indexer.requestKeys(address);
			const bcs = Object.keys(rawRemoteKeys);
			for (const bc of bcs) {
				remoteKeys[bc] = {
					...rawRemoteKeys[bc],
					publicKey: PublicKey.fromBytes(PublicKeyType.YLIDE, rawRemoteKeys[bc].publicKey),
				};
			}
			return remoteKeys;
		};

		const indexerRemoteKeys = toReadFromIndexer.length
			? await this.indexer.retryingOperation(
					async () => {
						return readFromIndexer();
					},
					async () => {
						return readFromBlockchains(toReadFromIndexer);
					},
			  )
			: {};
		const blockchainRemoteKeys = toReadFromBlockchain.length ? await readFromBlockchains(toReadFromBlockchain) : {};

		const finalRemoteKeys = { ...indexerRemoteKeys, ...blockchainRemoteKeys };
		let freshestKey: ExternalYlidePublicKey | null = null;
		for (const bc of Object.keys(finalRemoteKeys)) {
			const key = finalRemoteKeys[bc];
			if (key) {
				if (!freshestKey) {
					freshestKey = key;
				} else if (key.timestamp > freshestKey.timestamp) {
					freshestKey = key;
				}
			}
		}
		return {
			freshestKey,
			remoteKeys: finalRemoteKeys,
		};
	}

	getListSources(readingSession: SourceReadingSession, subjects: ISourceSubject[]): IListSource[] {
		const sources: IListSource[] = [];
		for (const blockchainController of this.controllers.blockchains) {
			for (const subject of subjects) {
				const blockchainSubjects = blockchainController.getBlockchainSourceSubjects(subject);
				for (const blockchainSubject of blockchainSubjects) {
					const source = readingSession.getListSource(blockchainSubject);
					if (source) {
						sources.push(source);
					} else {
						if (
							blockchainSubject.type === BlockchainSourceType.DIRECT &&
							blockchainSubject.sender &&
							!blockchainController.isReadingBySenderAvailable()
						) {
							const shrinkedSubject = {
								...blockchainSubject,
								sender: null,
							};
							let originalList = readingSession.getListSource(shrinkedSubject);
							if (!originalList) {
								const originalSource = blockchainController.ininiateMessagesSource(shrinkedSubject);
								originalList = new ListSource(readingSession, shrinkedSubject, originalSource);
								readingSession.setListSource(shrinkedSubject, originalList);
							}
							const filteredList = new PuppetListSource(readingSession, blockchainSubject, originalList);
							readingSession.setListSource(blockchainSubject, filteredList);
							sources.push(filteredList);
						} else {
							const originalSource = blockchainController.ininiateMessagesSource(blockchainSubject);
							if (this.indexerBlockchains.includes(blockchainController.blockchain())) {
								const indexerLowLevel = new IndexerMessagesSource(
									originalSource,
									this.indexer,
									blockchainController.compareMessagesTime.bind(blockchainController),
									blockchainSubject,
								);
								const indexerListSource = new ListSource(
									readingSession,
									blockchainSubject,
									indexerLowLevel,
								);
								readingSession.setListSource(blockchainSubject, indexerListSource);
								sources.push(indexerListSource);
							} else {
								const listSource = new ListSource(readingSession, blockchainSubject, originalSource);
								readingSession.setListSource(blockchainSubject, listSource);
								sources.push(listSource);
							}
						}
					}
				}
			}
		}
		return sources;
	}

	async sendMessage(
		{ wallet, sender, content, recipients, serviceCode = ServiceCode.SDK, copyOfSent = true }: SendMessageArgs,
		walletOptions?: any,
	) {
		const { encodedContent, key } = MessageEncodedContent.encodeContent(content);
		const actualRecipients = recipients.map(r => {
			const bc = this.controllers.blockchains.find(b => b.isAddressValid(r));
			if (!bc) {
				throw new Error(`Address ${r} is not valid for any registered blockchain`);
			}
			return {
				keyAddress: bc.addressToUint256(r),
				keyAddressOriginal: r,
				address: bc.addressToUint256(r),
			};
		});
		if (copyOfSent) {
			actualRecipients.push({
				keyAddress: wallet.addressToUint256(sender.address),
				keyAddressOriginal: sender.address,
				address: YlideCore.getSentAddress(wallet.addressToUint256(sender.address)),
			});
		}
		const route = await DynamicEncryptionRouter.findEncyptionRoute(
			this,
			actualRecipients,
			this.controllers.blockchains,
			'ylide',
		);
		const { publicKeys, processedRecipients } = await DynamicEncryptionRouter.executeEncryption(route, key);
		const container = MessageContainer.packContainer(serviceCode, true, publicKeys, encodedContent);
		return wallet.sendMail(sender, container, processedRecipients, walletOptions);
	}

	async broadcastMessage(
		{ wallet, sender, content, serviceCode = ServiceCode.SDK }: BroadcastMessageArgs,
		walletOptions?: any,
	) {
		const { nonEncodedContent } = MessageEncodedContent.packContent(content);
		const container = MessageContainer.packContainer(serviceCode, false, [], nonEncodedContent);
		return wallet.sendBroadcast(sender, container, walletOptions);
	}

	async getMessageControllers(
		msg: IMessage,
		keyAddress?: Uint256,
	): Promise<{ blockchain: AbstractBlockchainController; wallet: AbstractWalletController }> {
		const blockchain = this.controllers.blockchainsMap[msg.blockchain];
		if (!blockchain) {
			throw new Error(`Blockchain ${msg.blockchain} not found`);
		}
		const blockchainGroup = Ylide.blockchainToGroupMap[msg.blockchain];
		const walletsMap = this.controllers.walletsMap[blockchainGroup];
		if (!walletsMap) {
			throw new Error(`Wallet for ${blockchainGroup} was not found`);
		}
		const address = keyAddress || msg.recipientAddress;
		const wallets = Object.values(walletsMap);
		for (const wallet of wallets) {
			const acc = await wallet.getAuthenticatedAccount();
			if (!acc) {
				continue;
			}
			const rec = blockchain.addressToUint256(acc.address);
			if (rec === address) {
				return { blockchain, wallet };
			}
		}
		throw new Error(`Wallet for ${address} was not found`);
	}

	async decryptMessageContent(recipient: IGenericAccount, msg: IMessage, content: IMessageContent) {
		const receipientKeyAddress = recipient.address;
		const unpackedContent = MessageContainer.unpackContainter(content.content);
		let decryptedContent;
		if (unpackedContent.isEncoded) {
			const msgKey = MessageKey.fromBytes(msg.key);
			const publicKey = unpackedContent.senderPublicKeys[msgKey.publicKeyIndex];
			let symmKey: Uint8Array | null = null;
			if (publicKey.type === PublicKeyType.YLIDE) {
				const ylideKey = this.keystore.get(receipientKeyAddress);
				if (!ylideKey) {
					throw new Error('Key of this message recipient is not derived');
				}
				await ylideKey.execute('read mail', async keypair => {
					symmKey = keypair.decrypt(msgKey.encryptedMessageKey, publicKey.bytes);
				});
			} else {
				const walletAccounts = await Promise.all(
					this.controllers.wallets.map(async w => ({
						wallet: w,
						account: await w.getAuthenticatedAccount(),
					})),
				);
				const accountIdx = walletAccounts.findIndex(
					a => a.account && a.account.address === receipientKeyAddress,
				);
				if (accountIdx === -1) {
					throw new Error(`Wallet of this message recipient ${receipientKeyAddress} is not registered`);
				}
				const account = walletAccounts[accountIdx].account;
				if (!account) {
					throw new Error(`Account of this message recipient ${receipientKeyAddress} is not available`);
				}
				const wallet = walletAccounts[accountIdx].wallet;
				symmKey = await wallet.decryptMessageKey(account, publicKey, msgKey.encryptedMessageKey);
			}
			if (!symmKey) {
				throw new Error('Unable to find decryption route');
			}
			decryptedContent = MessageEncodedContent.decodeRawContent(unpackedContent.content, symmKey);
		} else {
			decryptedContent = MessageEncodedContent.unpackRawContent(unpackedContent.content);
		}
		const decodedContent = MessageEncodedContent.messageContentFromBytes(decryptedContent);
		return {
			...decodedContent,
			serviceCode: unpackedContent.serviceCode,
			decryptedContent,
		};
	}

	decryptBroadcastContent(msg: IMessage, content: IMessageContent) {
		const unpackedContent = MessageContainer.unpackContainter(content.content);
		if (unpackedContent.isEncoded) {
			throw new Error(`Can't decode encrypted content`);
		}
		const decryptedContent = MessageEncodedContent.unpackRawContent(unpackedContent.content);
		const decodedContent = MessageEncodedContent.messageContentFromBytes(decryptedContent);

		return {
			...decodedContent,
			serviceCode: unpackedContent.serviceCode,
			decryptedContent,
		};
	}
}
