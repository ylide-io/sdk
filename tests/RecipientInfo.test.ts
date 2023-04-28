import { expect } from 'chai';
import { RecipientInfo } from '../src/content/RecipientInfo';

describe('RecipientInfo', () => {
	it('Conversion without alias', () => {
		const info = new RecipientInfo({
			address: '0x123',
			blockchain: 'ethereum',
		});
		const infoBytes = info.toBytes();
		const decodedData = RecipientInfo.fromBytes(infoBytes);
		expect(info).deep.equal(decodedData);
	});

	it('Conversion with alias', () => {
		const info = new RecipientInfo({
			address: '0x123',
			blockchain: 'ethereum',
			alias: { type: 'ENS', data: 'mydomain.eth' },
		});
		const infoBytes = info.toBytes();
		const decodedData = RecipientInfo.fromBytes(infoBytes);
		expect(info).deep.equal(decodedData);
	});
});
