import nacl from 'tweetnacl';
import { AbstractBlockchainController } from '../abstracts';
import { MessageKey } from '../content';
import { symmetricEncrypt } from '../crypto';
import { IExtraEncryptionStrateryEntry, PublicKey, PublicKeyType } from '../types';
import { Uint256 } from '../types/Uint256';

export interface IAvailableStrategy {
	type: string;
	blockchainController: AbstractBlockchainController;
	data: { ylide: true; publicKey: PublicKey } | IExtraEncryptionStrateryEntry;
}

export class DynamicEncryptionRouter {
	static async findEncyptionRoute(
		recipients: {
			keyAddress: Uint256;
			keyAddressOriginal: string;
			address: Uint256;
		}[],
		blockchainControllers: AbstractBlockchainController[],
		preferredStrategy: string = 'ylide',
	) {
		const recipientsMap = await this.identifyEncryptionStrategies(
			recipients.map(r => ({ address: r.keyAddress, original: r.keyAddressOriginal })),
			blockchainControllers,
		);
		return this.findBestEncryptionRouting(recipients, recipientsMap, blockchainControllers, preferredStrategy);
	}

	private static panic(): never {
		throw 0;
	}

	static async executeEncryption(
		route: ReturnType<typeof DynamicEncryptionRouter['findBestEncryptionRouting']>,
		key: Uint8Array,
	) {
		const ylideEphemeral = nacl.box.keyPair.fromSecretKey(nacl.randomBytes(32));
		const ylideEphemeralPublic = PublicKey.fromBytes(PublicKeyType.YLIDE, ylideEphemeral.publicKey);
		const publicKeys: PublicKey[] = [];
		const result: { address: Uint256; messageKey: MessageKey }[] = [];
		for (const entity of route) {
			if (entity.type === 'ylide') {
				const pkIdx = publicKeys.push(ylideEphemeralPublic) - 1;
				result.push(
					...entity.entries.map((entry, idx) => ({
						address: entity.recipients[idx].address,
						messageKey: new MessageKey(
							pkIdx,
							entry.ylide
								? symmetricEncrypt(
										key,
										nacl.box.before(entry.publicKey.bytes, ylideEphemeral.secretKey),
								  )
								: this.panic(),
						),
					})),
				);
			} else {
				const entries: IExtraEncryptionStrateryEntry[] = entity.entries as IExtraEncryptionStrateryEntry[];
				const bulk = await entity.blockchainController.prepareExtraEncryptionStrategyBulk(entries);
				let pkIdx: number | null = null;
				if (bulk.addedPublicKey) {
					pkIdx = publicKeys.push(bulk.addedPublicKey.key) - 1;
				}
				const temp = await entity.blockchainController.executeExtraEncryptionStrategy(
					entries,
					bulk,
					pkIdx,
					key,
				);
				result.push(
					...temp.map((t, idx) => ({
						address: entity.blockchainController.addressToUint256(entries[idx].address),
						messageKey: t,
					})),
				);
			}
		}
		return {
			processedRecipients: result,
			publicKeys,
		};
	}

	private static async identifyEncryptionStrategies(
		recipients: { address: Uint256; original: string }[],
		blockchainControllers: AbstractBlockchainController[],
	) {
		const recipientsMap: Record<Uint256, IAvailableStrategy[]> = {};
		for (const recipient of recipients) {
			for (const blockchainController of blockchainControllers) {
				if (!blockchainController.isAddressValid(recipient.original)) {
					continue;
				}
				const arr = recipientsMap[recipient.address] || [];
				const strategies = [];
				let ylideKey;
				try {
					ylideKey = await blockchainController.extractPublicKeyFromAddress(recipient.original);
				} catch (err) {
					ylideKey = null;
				}
				if (ylideKey) {
					strategies.push({
						type: 'ylide',
						blockchainController,
						data: { ylide: true as true, publicKey: ylideKey.publicKey },
					});
				}
				const nativeStrategies = await blockchainController.getExtraEncryptionStrategiesFromAddress(
					recipient.original,
				);
				strategies.push(
					...nativeStrategies.map(ns => ({
						type: ns.type,
						blockchainController,
						data: ns,
					})),
				);
				arr.push(...strategies);
				recipientsMap[recipient.address] = arr;
			}
		}
		return recipientsMap;
	}

	private static getStrategiesFrequency(strategies: string[][]): Record<string, number> {
		const result: Record<string, number> = {};
		for (const recipientStrategies of strategies) {
			for (const strategy of recipientStrategies) {
				result[strategy] = (result[strategy] || 0) + 1;
			}
		}
		return result;
	}

	private static getMostFrequent(frequencies: Record<string, number>): string {
		const reverseMap = Object.keys(frequencies).map(strategy => ({
			strategy,
			frequency: frequencies[strategy],
		}));
		reverseMap.sort((a, b) => b.frequency - a.frequency); // desc
		return reverseMap[0].strategy;
	}

	private static findBestEncryptionRouting(
		recipients: { keyAddress: Uint256; keyAddressOriginal: string; address: Uint256 }[],
		recipientsMap: Record<Uint256, IAvailableStrategy[]>,
		blockchainControllers: AbstractBlockchainController[],
		preferredStrategy: string = 'ylide',
	) {
		const usedStrategies: Record<string, boolean> = {};
		const selectedStrategyMap: Record<Uint256, IAvailableStrategy | null> = {};
		const uniqueRecipientStrategies: Record<Uint256, string[]> = {};
		const badBoys: Record<Uint256, boolean> = {};
		let ambigiousRecipients = [];
		for (const recipient of recipients) {
			const map = recipientsMap[recipient.keyAddress];
			if (map.length === 0) {
				badBoys[recipient.keyAddress] = true;
				selectedStrategyMap[recipient.keyAddress] = null;
			}
			const uniqueStrategies = map.map(ns => ns.type).filter((e, i, a) => a.indexOf(e) === i);
			if (uniqueStrategies.length === 0) {
				badBoys[recipient.keyAddress] = true;
				selectedStrategyMap[recipient.keyAddress] = null;
				// should never happen, actually
			} else if (uniqueStrategies.length === 1) {
				usedStrategies[uniqueStrategies[0]] = true;
				selectedStrategyMap[recipient.keyAddress] = map.find(s => s.type === uniqueStrategies[0])!;
			} else {
				uniqueRecipientStrategies[recipient.keyAddress] = uniqueStrategies;
			}
		}
		for (const recipient of recipients) {
			if (selectedStrategyMap[recipient.keyAddress] || badBoys[recipient.keyAddress]) {
				continue;
			}
			const uniqueStrategies = uniqueRecipientStrategies[recipient.keyAddress];
			const availableStrategy = uniqueStrategies.find(uS => usedStrategies[uS]);
			if (!availableStrategy) {
				if (uniqueStrategies.includes(preferredStrategy)) {
					usedStrategies[preferredStrategy] = true;
					selectedStrategyMap[recipient.keyAddress] = recipientsMap[recipient.keyAddress].find(
						s => s.type === preferredStrategy,
					)!;
				} else {
					ambigiousRecipients.push(recipient);
				}
				continue;
			}
			selectedStrategyMap[recipient.keyAddress] = recipientsMap[recipient.keyAddress].find(
				s => s.type === availableStrategy,
			)!;
		}
		while (ambigiousRecipients.length) {
			const frequencies = this.getStrategiesFrequency(
				ambigiousRecipients.map(r => uniqueRecipientStrategies[r.keyAddress]),
			);
			const mostFrequent = this.getMostFrequent(frequencies);
			const newAmbigiousRecipients = [];
			for (const rec of ambigiousRecipients) {
				const strats = uniqueRecipientStrategies[rec.keyAddress];
				if (strats.includes(mostFrequent)) {
					usedStrategies[mostFrequent] = true;
					selectedStrategyMap[rec.keyAddress] = recipientsMap[rec.keyAddress].find(
						s => s.type === mostFrequent,
					)!;
				} else {
					newAmbigiousRecipients.push(rec);
				}
			}
			ambigiousRecipients = newAmbigiousRecipients;
		}
		const strategiesList = Object.keys(usedStrategies);
		const strategiesControllers: Record<string, AbstractBlockchainController> = {};
		for (const strategy of strategiesList) {
			strategiesControllers[strategy] = blockchainControllers.find(c =>
				c.getSupportedExtraEncryptionStrategies().includes(strategy),
			)!;
		}
		const route = strategiesList.map(strategy => {
			const recs = recipients.filter(r => selectedStrategyMap[r.keyAddress]?.type === strategy);
			return {
				type: strategy,
				blockchainController: strategiesControllers[strategy] || null,
				recipients: recs,
				entries: recs.map(r => selectedStrategyMap[r.keyAddress]!.data),
			};
		});
		route.sort((a, b) => b.recipients.length - a.recipients.length); // desc
		return route;
	}
}
