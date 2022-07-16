import Ylide from '..';
import { IGenericAccount } from '../types/IGenericAccount';
import { IMessage, RetrievingMessagesOptions } from '../types/IMessage';
import { AbstractSendingController } from '../abstracts/AbstractSendingController';
import { testMessagingState } from './TestReadingController';
import { YlideUnencryptedKeyPair } from '../keystore/YlideUnencryptedKeyPair';
import { MessageContent } from '../content/MessageContent';

export class TestSendingController extends AbstractSendingController {
	constructor(options: any) {
		super(options);
	}

	// wallet block
	static async isWalletAvailable(): Promise<boolean> {
		return true;
	}

	static walletType(): string {
		return 'test';
	}

	static blockchainType(): string {
		return 'test';
	}

	// account block
	async getAuthenticatedAccount(): Promise<IGenericAccount | null> {
		if (testMessagingState.auth) {
			return testMessagingState.account;
		} else {
			return null;
		}
	}

	async requestAuthentication(): Promise<null | IGenericAccount> {
		const result = await testMessagingState.requestAuthHandler();
		if (result) {
			testMessagingState.auth = true;
		}
		return result;
	}

	async disconnectAccount(): Promise<void> {
		if (!testMessagingState.auth) {
			throw new Error('Not authorized');
		}
		testMessagingState.auth = false;
	}

	async deriveMessagingKeypair(magicString: string): Promise<Uint8Array> {
		return new Uint8Array();
	}

	// message send block
	async sendMessage(
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: { address: string; publicKey: Uint8Array }[],
	): Promise<string | null> {
		const msg = {
			id: `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Math.random() * 1000000000)}`,
			// txId: `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Math.random() * 1000000000)}`,
			// sender: sender.address,
			// recipient: recipient.address,
			// body: text,
			// time: new Date().toISOString(),
		};
		// testMessagingState.messages.push(msg);
		return msg.id;
	}

	// message history block
	async retrieveMessageHistoryByDates(
		recipientAddress: string,
		options?: RetrievingMessagesOptions,
	): Promise<IMessage[]> {
		return testMessagingState.messages
			.filter(t => t.recipient === recipientAddress)
			.map(t => ({
				body: t.body,
				created_at: Math.floor(new Date(t.time).getTime() / 1000),
				created_lt: t.txId,
				dst: testMessagingState.account.address,
				id: t.id,
				src: 'contract-address',
				sender: t.sender,
				data: 'test',
				nonce: 'test',
			}));
	}

	async retrieveMessageById(id: string): Promise<IMessage | null> {
		const m = testMessagingState.messages.find(t => t.id === id);
		if (!m) {
			return null;
		}
		return {
			body: m.body,
			created_at: Math.floor(new Date(m.time).getTime() / 1000),
			created_lt: m.txId,
			dst: testMessagingState.account.address,
			id: m.id,
			src: 'contract-address',
			sender: m.sender,
			data: 'test',
			nonce: 'test',
		};
	}
}
