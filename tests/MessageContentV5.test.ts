import { expect } from 'chai';
import { MessageContentV5 } from './../src/content/MessageContentV5';
import { RecipientInfo } from './../src/content/RecipientInfo';
import { YMF } from './../src/content/YMF';

describe('MessageContentV5', () => {
	it('Conversion without attachments', () => {
		const content = new MessageContentV5({
			sendingAgentName: 'My Agent',
			sendingAgentVersion: { major: 1, minor: 2, patch: 3 },
			subject: 'My Subject',
			content: YMF.fromPlainText('My Content'),
			extraBytes: new Uint8Array([1, 2, 3]),
			extraJson: { foo: 'bar' },
			attachments: [],
			recipientInfos: [
				new RecipientInfo({
					address: '0x123',
					blockchain: 'ethereum',
					alias: { type: 'ENS', data: 'mydomain.eth' },
				}),
				new RecipientInfo({
					address: '0x456',
					blockchain: 'polygon',
				}),
			],
		});
		const bytes = content.toBytes();
		const decodedData = MessageContentV5.fromBytes(bytes);
		expect(MessageContentV5.isValid(bytes)).equal(true);
		expect(content).deep.equal(decodedData);
	});
});
