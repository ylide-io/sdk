import Ylide from '..';
import { IGenericAccount } from '../types/IGenericAccount';
import { IMessage, RetrievingMessagesOptions } from '../types/IMessage';
import { AbstractReadingController } from '../abstracts/AbstractReadingController';

export const testMessagingState = {
	auth: false,
	account: {
		address: 'test-address',
		publicKey: 'test-public-key',
	},
	anotherAccount: {
		address: 'another-address',
		publicKey: 'another-public-key',
	},
	messages: [
		{
			id: '123',
			txId: '321',
			sender: 'test-address',
			recipient: 'another-address',
			body: 'hello!',
			time: new Date().toISOString(),
		},
	],
	requestAuthHandler: (async () => null) as () => Promise<IGenericAccount | null>,
};

export class TestReadingController extends AbstractReadingController {
	constructor(options: any) {
		super(options);
	}

	static blockchainType(): string {
		return 'test';
	}

	isAddressValid(address: string): boolean {
		return address === testMessagingState.account.address || address === testMessagingState.anotherAccount.address;
	}

	// message send block
	async sendMessage(text: string, sender: IGenericAccount, recipient: IGenericAccount): Promise<string | null> {
		const msg = {
			id: `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Math.random() * 1000000000)}`,
			txId: `${Math.floor(Math.random() * 1000000000)}.${Math.floor(Math.random() * 1000000000)}`,
			sender: sender.address,
			recipient: recipient.address,
			body: text,
			time: new Date().toISOString(),
		};
		testMessagingState.messages.push(msg);
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

	async decodeMailText(
		senderAddress: string,
		recipient: IGenericAccount,
		data: string,
		nonce: string,
	): Promise<string> {
		return data;
	}

	async getRecipientReadingRules(address: string): Promise<any> {
		return null;
	}

	async extractPublicKeyFromAddress(address: string): Promise<string | null> {
		if (address === testMessagingState.account.address) {
			return testMessagingState.account.publicKey;
		}
		if (address === testMessagingState.anotherAccount.address) {
			return testMessagingState.anotherAccount.publicKey;
		}
		return null;
	}

	async extractAddressFromPublicKey(publicKey: string): Promise<string | null> {
		if (publicKey === testMessagingState.account.publicKey) {
			return testMessagingState.account.address;
		}
		if (publicKey === testMessagingState.anotherAccount.publicKey) {
			return testMessagingState.anotherAccount.address;
		}
		return null;
	}
}
