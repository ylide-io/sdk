import { MessageBlob } from '../content/MessageBlob';
import { MessageSecureContext } from '../content/MessageSecureContext';
import { IndexerHub } from '../indexer/IndexerHub';
import { IndexerMessagesSource } from '../indexer/IndexerMessagesSource';
import { PuppetListSource } from '../messages-list/mid-level/PuppetListSource';
import { uint256ToUint8Array, uint8ArrayToUint256 } from '../primitives/Uint256';
import { sha256 } from '../crypto/sha256';
import { RemotePublicKey } from '../keystore/RemotePublicKey';
import { PublicKeyType } from '../primitives/PublicKeyType';
import { PublicKey } from '../primitives/PublicKey';
import { ListSource } from '../messages-list/mid-level/ListSource';
import { ServiceCode } from '../primitives/ServiceCode';
import { DynamicEncryptionRouter } from '../cross-chain/DynamicEncryptionRouter';
import { YLIDE_MAIN_FEED_ID } from '../utils/constants';
import { MessageContainer } from '../content/MessageContainer';
import { MessageKey } from '../content/MessageKey';
import { YlideError, YlideErrorType } from '../errors/YlideError';
import { YlideMisusageError } from '../errors/YlideMisusageError';

import type { YlidePrivateKey, YlidePrivateKeyHandlers } from '../keystore';
import type { WalletAccount } from '../primitives/WalletAccount';
import type { IUnpackedMessageContainer } from '../content/MessageContainer';
import type { Uint256 } from '../primitives/Uint256';
import type { YlideKeyRegistry } from '../keystore/YlideKeysRegistry';
import type { IMessage, IMessageContent, IMessageCorruptedContent } from '../primitives/IMessage';
import type { IListSource } from '../messages-list/types/IListSource';
import type { SourceReadingSession } from '../messages-list/SourceReadingSession';
import type { ISourceSubject } from '../messages-list/types/IBlockchainSourceSubject';
import type { AbstractBlockchainController } from '../abstracts/AbstractBlockchainController';
import type { BlockchainControllerFactory } from '../abstracts/BlockchainControllerFactory';
import type { AbstractWalletController } from '../abstracts/AbstractWalletController';
import type { YlideControllers } from './YlideControllers';
import type { MessageContentV3 } from '../content/MessageContentV3';
import type { MessageContentV4 } from '../content/MessageContentV4';
import type { MessageContentV5 } from './../content/MessageContentV5';
import type { MessageContent } from '../content/MessageContent';
import type { Ylide } from '../Ylide';

export interface SendMessageArgs {
	wallet: AbstractWalletController;
	sender: WalletAccount;
	content: MessageContent;
	recipients: string[];
	secureContext?: MessageSecureContext;
	feedId?: Uint256;
	serviceCode?: number;
	copyOfSent?: boolean;
}

export interface BroadcastMessageArgs {
	wallet: AbstractWalletController;
	sender: WalletAccount;
	feedId: Uint256;
	content: MessageContent;
	serviceCode?: number;
}

export class YlideCore {
	readonly indexer: IndexerHub;

	constructor(
		public readonly ylide: Ylide,
		public readonly controllers: YlideControllers,
		public readonly keyRegistry: YlideKeyRegistry,
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
				freshestKey: RemotePublicKey | null;
				remoteKeys: Record<string, RemotePublicKey | null>;
			}
		>
	> {
		const blockchains = this.ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		let indexerResult: Record<string, Record<string, RemotePublicKey | null>> = {};

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
						const result: Record<string, Record<string, RemotePublicKey | null>> = {};
						for (const address of Object.keys(rawResult)) {
							for (const bc of Object.keys(rawResult[address])) {
								if (!result[address]) {
									result[address] = {};
								}
								const kkey = rawResult[address][bc];
								const bcGroup = this.getBlockchainGroupByBlockchain(bc);
								if (bcGroup) {
									result[address][bc] = kkey
										? new RemotePublicKey(
												bcGroup,
												bc,
												address,
												new PublicKey(PublicKeyType.YLIDE, kkey.keyVersion, kkey.publicKey),
												kkey.timestamp,
												kkey.registrar,
										  )
										: null;
								}
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
			const blockchainRemoteKeys: Record<string, Record<string, RemotePublicKey | null>> = {};
			await Promise.all(
				addresses.map(async address => {
					const remoteKeys: Record<string, RemotePublicKey | null> = {};

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

		const globalResult: Record<string, Record<string, RemotePublicKey | null>> = {};
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
				freshestKey: RemotePublicKey | null;
				remoteKeys: Record<string, RemotePublicKey | null>;
			}
		> = {};
		for (const address of addresses) {
			const remoteKeys = globalResult[address];
			const bcs = Object.keys(remoteKeys);
			let freshestKey: RemotePublicKey | null = null;
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

	getBlockchainGroupByBlockchain(blockchain: string): string | undefined {
		return this.ylide.blockchainsList.find(b => b.factory.blockchain === blockchain)?.factory.blockchainGroup;
	}

	async getAddressKeys(address: string): Promise<{
		freshestKey: RemotePublicKey | null;
		remoteKeys: Record<string, RemotePublicKey | null>;
	}> {
		const blockchains = this.ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		const toReadFromBlockchain = blockchains.filter(b => !this.indexerBlockchains.includes(b.factory.blockchain));
		const toReadFromIndexer = blockchains.filter(b => this.indexerBlockchains.includes(b.factory.blockchain));

		const readFromBlockchains = async (
			fromBlockchains: { factory: BlockchainControllerFactory; controller: AbstractBlockchainController }[],
		) => {
			const remoteKeys: Record<string, RemotePublicKey | null> = {};
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
				const remoteKeys: Record<string, RemotePublicKey | null> = {};
				const rawRemoteKeys = await this.indexer.requestKeys(address);
				const bcs = Object.keys(rawRemoteKeys);
				for (const bc of bcs) {
					const aggr = {
						...rawRemoteKeys[bc],
						publicKey: new PublicKey(
							PublicKeyType.YLIDE,
							rawRemoteKeys[bc].keyVersion,
							rawRemoteKeys[bc].publicKey,
						),
					};
					const bcGroup = this.getBlockchainGroupByBlockchain(bc);
					if (bcGroup) {
						remoteKeys[bc] = new RemotePublicKey(
							bcGroup,
							bc,
							address.toLowerCase(),
							aggr.publicKey,
							aggr.timestamp,
							aggr.registrar,
						);
					}
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
		let freshestKey: RemotePublicKey | null = null;
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

	async getAddressesKeysHistory(addresses: string[]): Promise<Record<string, RemotePublicKey[]>> {
		const blockchains = this.ylide.blockchainsList.map(({ factory }) => ({
			factory,
			controller: this.controllers.blockchainsMap[factory.blockchain],
		}));

		const indexerResult: Record<string, RemotePublicKey[]> = {};

		// if (this.indexerBlockchains.length) {
		// 	indexerResult = await this.indexer.retryingOperation(
		// 		async () => {
		// 			const rawResult = await this.indexer.requestKeysHistory(addresses);
		// 			const result: Record<string, { key: RemotePublicKey; blockchain: string }[]> = {};
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
			const blockchainRemoteKeys: Record<string, RemotePublicKey[]> = {};

			await Promise.all(
				addresses.map(async address => {
					const remoteKeys: RemotePublicKey[] = [];

					await Promise.all(
						fromBlockchains.map(async ({ controller }) => {
							try {
								if (controller.isAddressValid(address)) {
									const keys = await controller.extractPublicKeysHistoryByAddress(address);
									remoteKeys.push(...keys);
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

		const globalResult: Record<string, RemotePublicKey[]> = {};
		// merge results:
		for (const address of addresses) {
			globalResult[address] = [...(indexerResult[address] || []), ...(blockchainsResult[address] || [])];
			globalResult[address].sort((a, b) => b.timestamp - a.timestamp);
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
				throw new YlideError(
					YlideErrorType.INVALID_PARAM,
					`Address ${r} is not valid for any registered blockchain`,
				);
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

	async getMessageByMsgId(msgId: string): Promise<IMessage | null> {
		for (const controller of this.controllers.blockchains) {
			if (controller.isValidMsgId(msgId)) {
				try {
					return await controller.getMessageByMsgId(msgId);
				} catch (err) {
					console.error('Error getting message by msgId', err);
					return null;
				}
			}
		}
		return null;
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
		const blockchainGroup = this.ylide.blockchainToGroupMap[msg.blockchain];
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
		recipient: WalletAccount,
		msg: IMessage,
		unpackedContainer: IUnpackedMessageContainer,
		handlers?: YlidePrivateKeyHandlers,
	) {
		const receipientKeyAddress = recipient.address;

		const msgKey = MessageKey.fromBytes(msg.key);
		const senderPublicKey = unpackedContainer.senderPublicKeys[msgKey.publicKeyIndex];

		let symmKey: Uint8Array | null = null;
		if (senderPublicKey.type === PublicKeyType.YLIDE) {
			const keySignature = msgKey.decryptingPublicKeySignature;
			const keysToCheck: YlidePrivateKey[] = [];
			if (keySignature) {
				const key = this.keyRegistry.getLocalPrivateKeyForPublicKeySignature(
					receipientKeyAddress,
					keySignature,
				);
				if (key) {
					keysToCheck.push(key);
				}
			} else {
				keysToCheck.push(...this.keyRegistry.getLocalPrivateKeys(receipientKeyAddress));
			}
			if (!keysToCheck.length) {
				throw new YlideError(YlideErrorType.DECRYPTION_KEY_UNAVAILABLE, 'Unable to find decryption key', {
					signature: keySignature,
				});
			}
			for (const ylideKey of keysToCheck) {
				try {
					await ylideKey.execute(async keypair => {
						symmKey = keypair.decrypt(msgKey.encryptedMessageKey, senderPublicKey.keyBytes);
					}, handlers);
					if (symmKey) {
						break;
					}
				} catch (err) {
					console.warn('Error decrypting message key', err);
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
				throw new YlideError(
					YlideErrorType.UNAVAILABLE,
					`Native decription: Wallet of this message recipient ${receipientKeyAddress} is not registered`,
				);
			}
			const account = walletAccounts[accountIdx].account;
			if (!account) {
				throw new YlideError(
					YlideErrorType.UNAVAILABLE,
					`Native decription: Account of this message recipient ${receipientKeyAddress} is not available`,
				);
			}
			const wallet = walletAccounts[accountIdx].wallet;
			symmKey = await wallet.decryptMessageKey(account, senderPublicKey, msgKey.encryptedMessageKey);
		}
		if (!symmKey) {
			throw new YlideError(
				YlideErrorType.DECRYPTION_KEY_UNAVAILABLE,
				'No decryption key is able to decrypt this message key',
			);
		}
		return new MessageSecureContext(symmKey);
	}

	async decryptMessageContent(
		recipient: WalletAccount,
		msg: IMessage,
		content: IMessageContent,
		secureContext?: MessageSecureContext,
		handlers?: YlidePrivateKeyHandlers,
	) {
		const unpackedContainer = MessageContainer.unpackContainter(content.content);

		let decryptedContent: MessageContentV3 | MessageContentV4 | MessageContentV5;

		if (unpackedContainer.isEncoded) {
			if (!secureContext) {
				secureContext = await this.getMessageSecureContext(recipient, msg, unpackedContainer, handlers);
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
			throw new YlideMisusageError(
				'YlideCore',
				`Encrypted broadcast content is not supported in YlideCore. You still can decrypt it using raw Ylide crypto primitives.`,
			);
		}
		const decodedContent = MessageBlob.unpackAndDecode(unpackedContainer.messageBlob);

		return {
			content: decodedContent,
			serviceCode: unpackedContainer.serviceCode,
			container: unpackedContainer,
		};
	}
}
