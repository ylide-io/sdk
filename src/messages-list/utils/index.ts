import { BlockchainSourceType, IBlockchainSourceSubject, ISourceSubject } from '../types/IBlockchainSourceSubject';

export const shrinkSubject = (subject: IBlockchainSourceSubject): IBlockchainSourceSubject => {
	if (subject.type === BlockchainSourceType.BROADCAST) {
		return {
			namespace: subject.namespace,
			type: BlockchainSourceType.BROADCAST,
			blockchain: subject.blockchain,
			id: subject.id,
			feedId: subject.feedId,
			sender: null,
		};
	} else {
		return {
			namespace: subject.namespace,
			type: BlockchainSourceType.DIRECT,
			blockchain: subject.blockchain,
			id: subject.id,
			recipient: subject.recipient,
			sender: null,
		};
	}
};

export const expandSubject = (subject: ISourceSubject, blockchain: string, id: string) => ({
	...subject,
	blockchain,
	id,
});

export const isWideSubject = (subject: IBlockchainSourceSubject) => {
	return subject.type === BlockchainSourceType.DIRECT && !!subject.sender;
};
