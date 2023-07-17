import {
	AbstractBlockchainController,
	AbstractWalletController,
	BlockchainControllerFactory,
	DynamicEncryptionRouter,
	ExternalYlidePublicKey,
	IGenericAccount,
	IListSource,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	ISourceSubject,
	IUnpackedMessageContainer,
	ListSource,
	MessageContainer,
	MessageKey,
	PublicKey,
	PublicKeyType,
	PuppetListSource,
	ServiceCode,
	SourceReadingSession,
	Uint256,
	YLIDE_MAIN_FEED_ID,
	Ylide,
	YlideError,
	YlideErrorType,
	YlideKey,
	YlideKeyStore,
	sha256,
	uint256ToUint8Array,
	uint8ArrayToUint256,
} from '..';
import { MessageBlob } from '../content/MessageBlob';
import { MessageContent } from '../content/MessageContent';
import { MessageContentV3 } from '../content/MessageContentV3';
import { MessageContentV4 } from '../content/MessageContentV4';
import { MessageContentV5 } from './../content/MessageContentV5';
import { MessageSecureContext } from '../content/MessageSecureContext';
import { IndexerHub } from '../indexer';
import { IndexerMessagesSource } from '../indexer/IndexerMessagesSource';
import { YlideControllers } from './YlideControllers';

export interface SendMessageArgs {
	wallet: AbstractWalletController;
	sender: IGenericAccount;
	content: MessageContent;
	recipients: string[];
	secureContext?: MessageSecureContext;
	feedId?: Uint256;
	serviceCode?: number;
	copyOfSent?: boolean;
}

export interface BroadcastMessageArgs {
	wallet: AbstractWalletController;
	sender: IGenericAccount;
	feedId: Uint256;
	content: MessageContent;
	serviceCode?: number;
}

export class YlideCore {
	readonly indexer: IndexerHub;

	constructor(
		public readonly controllers: YlideControllers,
		public readonly keystore: YlideKeyStore,
		private readonly indexerBlockchains: string[] = [],
		useWebSocketPulling?: boolean,
	) {
		this.indexer = new IndexerHub(useWebSocketPulling);
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
			const indexerAddresses = addresses.filter(a =>
				blockchains
					.filter(b => this.indexerBlockchains.includes(b.factory.blockchain))
					.some(b => b.controller.isAddressValid(a)),
			);
			if (indexerAddresses.length) {
				indexerResult = await this.indexer.retryingOperation(
					async () => {
						const rawResult = await this.indexer.requestMultipleKeys(indexerAddresses);
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
				for (const address of indexerAddresses) {
					if (!indexerResult[address]) {
						indexerResult[address] = {};
					}
				}
			} else {
				for (const address of indexerAddresses) {
					if (!indexerResult[address]) {
						indexerResult[address] = {};
					}
				}
			}
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
			if (
				blockchains
					.filter(b => this.indexerBlockchains.includes(b.factory.blockchain))
					.some(b => b.controller.isAddressValid(address))
			) {
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
			} else {
				return {};
			}
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

	async getAddressesKeysHistory(
		addresses: string[],
	): Promise<Record<string, { key: ExternalYlidePublicKey; blockchain: string }[]>> {
		const blockchains = Ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		const indexerResult: Record<string, { key: ExternalYlidePublicKey; blockchain: string }[]> = {};

		// if (this.indexerBlockchains.length) {
		// 	indexerResult = await this.indexer.retryingOperation(
		// 		async () => {
		// 			const rawResult = await this.indexer.requestKeysHistory(addresses);
		// 			const result: Record<string, { key: ExternalYlidePublicKey; blockchain: string }[]> = {};
		// 			for (const address of Object.keys(rawResult)) {
		// 				if (!result[address]) {
		// 					result[address] = [];
		// 				}
		// 				for (const kkey of rawResult[address]) {
		// 					result[address].push({
		// 						blockchain: kkey.blockchain,
		// 						key: {
		// 							keyVersion: kkey.keyVersion,
		// 							publicKey: PublicKey.fromBytes(PublicKeyType.YLIDE, kkey.publicKey),
		// 							timestamp: kkey.timestamp,
		// 							registrar: kkey.registrar,
		// 						},
		// 					});
		// 				}
		// 			}
		// 			return result;
		// 		},
		// 		async () => {
		// 			return {};
		// 		},
		// 	);
		// }

		const toReadFromBlockchain = blockchains; // .filter(b => !this.indexerBlockchains.includes(b.factory.blockchain));

		const readFromBlockchains = async (
			fromBlockchains: { factory: BlockchainControllerFactory; controller: AbstractBlockchainController }[],
		) => {
			const blockchainRemoteKeys: Record<string, { key: ExternalYlidePublicKey; blockchain: string }[]> = {};

			await Promise.all(
				addresses.map(async address => {
					const remoteKeys: { key: ExternalYlidePublicKey; blockchain: string }[] = [];

					await Promise.all(
						fromBlockchains.map(async ({ factory, controller }) => {
							try {
								if (controller.isAddressValid(address)) {
									const keys = await controller.extractPublicKeysHistoryByAddress(address);
									remoteKeys.push(...keys.map(k => ({ key: k, blockchain: factory.blockchain })));
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

		const globalResult: Record<string, { key: ExternalYlidePublicKey; blockchain: string }[]> = {};
		// merge results:
		for (const address of addresses) {
			globalResult[address] = {
				...indexerResult[address],
				...blockchainsResult[address],
			};
			globalResult[address].sort((a, b) => b.key.timestamp - a.key.timestamp);
		}

		return globalResult;
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
						if (blockchainSubject.sender && !blockchainController.isReadingBySenderAvailable()) {
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
		{
			wallet,
			sender,
			content,
			recipients,
			secureContext,
			feedId,
			serviceCode = ServiceCode.SDK,
			copyOfSent = true,
		}: SendMessageArgs,
		walletOptions?: any,
	) {
		if (!secureContext) {
			secureContext = MessageSecureContext.create();
		}
		const encryptedMessageBlob = MessageBlob.encodeAndPackAndEncrypt(secureContext, content);
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
		const { publicKeys, processedRecipients } = await DynamicEncryptionRouter.executeEncryption(
			route,
			secureContext,
		);
		const container = MessageContainer.packContainer(serviceCode, true, publicKeys, encryptedMessageBlob);
		return wallet.sendMail(sender, feedId || YLIDE_MAIN_FEED_ID, container, processedRecipients, walletOptions);
	}

	async broadcastMessage(
		{ feedId, wallet, sender, content, serviceCode = ServiceCode.SDK }: BroadcastMessageArgs,
		walletOptions?: any,
	) {
		const encodedMessageBlob = MessageBlob.encodeAndPack(content);
		const container = MessageContainer.packContainer(serviceCode, false, [], encodedMessageBlob);
		return wallet.sendBroadcast(sender, feedId, container, walletOptions || {});
	}

	async getMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null> {
		const blockchain = this.getMessageBlockchainController(msg);
		if (!blockchain) {
			return null;
		}
		if (this.indexerBlockchains.includes(blockchain.blockchain())) {
			return await this.indexer.retryingOperation(
				async () => {
					return await this.indexer.requestContent({ blockchain: msg.blockchain, msgId: msg.msgId });
				},
				async () => {
					return await blockchain.retrieveMessageContent(msg);
				},
			);
		} else {
			return await blockchain.retrieveMessageContent(msg);
		}
	}

	getMessageBlockchainController(msg: IMessage): AbstractBlockchainController | null {
		const blockchain = this.controllers.blockchainsMap[msg.blockchain];
		if (!blockchain) {
			return null;
		} else {
			return blockchain;
		}
	}

	async getMessageWalletController(msg: IMessage, keyAddress?: Uint256): Promise<AbstractWalletController | null> {
		const blockchainGroup = Ylide.blockchainToGroupMap[msg.blockchain];
		const walletsMap = this.controllers.walletsMap[blockchainGroup];
		if (!walletsMap) {
			return null;
		}
		const address = keyAddress || msg.recipientAddress;
		const wallets = Object.values(walletsMap);
		for (const wallet of wallets) {
			const acc = await wallet.getAuthenticatedAccount();
			if (!acc) {
				continue;
			}
			const rec = wallet.addressToUint256(acc.address);
			if (rec === address) {
				return wallet;
			}
		}
		return null;
	}

	async getMessageSecureContext(
		recipient: IGenericAccount,
		msg: IMessage,
		unpackedContainer: IUnpackedMessageContainer,
	) {
		const receipientKeyAddress = recipient.address;

		const msgKey = MessageKey.fromBytes(msg.key);
		const publicKey = unpackedContainer.senderPublicKeys[msgKey.publicKeyIndex];

		let symmKey: Uint8Array | null = null;
		if (publicKey.type === PublicKeyType.YLIDE) {
			const ylideKeys = this.keystore.getAll(receipientKeyAddress);
			const keySignature = msgKey.decryptingPublicKeySignature;
			const keysToCheck: YlideKey[] = [];
			if (keySignature) {
				keysToCheck.push(
					...ylideKeys.filter(
						k =>
							DynamicEncryptionRouter.getPublicKeySignature(
								PublicKey.fromBytes(PublicKeyType.YLIDE, k.keypair.publicKey),
							) === keySignature,
					),
				);
			} else {
				keysToCheck.push(...ylideKeys);
			}
			if (!ylideKeys.length) {
				throw new YlideError(YlideErrorType.KEY_NOT_DERIVED, { signature: keySignature });
			}
			for (const ylideKey of keysToCheck) {
				try {
					await ylideKey.keypair.execute('read mail', async keypair => {
						symmKey = keypair.decrypt(msgKey.encryptedMessageKey, publicKey.bytes);
					});
					if (symmKey) {
						break;
					}
				} catch (err) {
					// wrong key, try next
				}
			}
		} else {
			const walletAccounts = await Promise.all(
				this.controllers.wallets.map(async w => ({
					wallet: w,
					account: await w.getAuthenticatedAccount(),
				})),
			);
			const accountIdx = walletAccounts.findIndex(a => a.account && a.account.address === receipientKeyAddress);
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
		return new MessageSecureContext(symmKey);
	}

	async decryptMessageContent(
		recipient: IGenericAccount,
		msg: IMessage,
		content: IMessageContent,
		secureContext?: MessageSecureContext,
	) {
		const unpackedContainer = MessageContainer.unpackContainter(content.content);

		let decryptedContent: MessageContentV3 | MessageContentV4 | MessageContentV5;

		if (unpackedContainer.isEncoded) {
			if (!secureContext) {
				secureContext = await this.getMessageSecureContext(recipient, msg, unpackedContainer);
			}
			decryptedContent = MessageBlob.decryptAndUnpackAndDecode(secureContext, unpackedContainer.messageBlob);
		} else {
			decryptedContent = MessageBlob.unpackAndDecode(unpackedContainer.messageBlob);
		}
		return {
			content: decryptedContent,
			serviceCode: unpackedContainer.serviceCode,
			container: unpackedContainer,
		};
	}

	decryptBroadcastContent(msg: IMessage, content: IMessageContent) {
		const unpackedContainer = MessageContainer.unpackContainter(content.content);
		if (unpackedContainer.isEncoded) {
			throw new Error(`Can't decode encrypted content`);
		}
		const decodedContent = MessageBlob.unpackAndDecode(unpackedContainer.messageBlob);

		return {
			content: decodedContent,
			serviceCode: unpackedContainer.serviceCode,
			container: unpackedContainer,
		};
	}
}
