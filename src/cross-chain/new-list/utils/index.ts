import { BlockchainSourceType } from '../../BlockchainSource';
import { IBlockchainSourceSubject } from '../types/IBlockchainSourceSubject';

export function shrinkSubject(subject: IBlockchainSourceSubject): IBlockchainSourceSubject {
	if (subject.type === BlockchainSourceType.BROADCAST) {
		return {
			type: BlockchainSourceType.BROADCAST,
			blockchain: subject.blockchain,
			sender: subject.sender,
		};
	} else {
		return {
			type: BlockchainSourceType.DIRECT,
			blockchain: subject.blockchain,
			recipient: subject.recipient,
			sender: null,
		};
	}
}

export function isWideSubject(subject: IBlockchainSourceSubject) {
	return subject.type === BlockchainSourceType.DIRECT && !!subject.sender;
}

export * from './AsyncEventEmitter';
export * from './CriticalSection';
