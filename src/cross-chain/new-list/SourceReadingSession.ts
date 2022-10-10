import { IMessage } from '../../types';
import { BlockchainSourceType } from '../BlockchainSource';
import { ListCache } from './ListCache';
import { ListStorage } from './ListStorage';
import { Repository } from './Repository';
import { IBlockchainSourceSubject } from './types/IBlockchainSourceSubject';

export class SourceReadingSession {
	//
	cacheRepository = new Repository<IBlockchainSourceSubject, ListCache<IMessage>>(this.sourceSubjectHash.bind(this));
	storageRepository = new Repository<IBlockchainSourceSubject, ListStorage<IMessage>>(
		this.sourceSubjectHash.bind(this),
	);

	sourceSubjectHash(k: IBlockchainSourceSubject) {
		if (k.type === BlockchainSourceType.BROADCAST) {
			return `bc:${k.blockchain}:${k.sender}`;
		} else {
			return `dm:${k.blockchain}:${k.sender}:${k.recipient}`;
		}
	}
}
