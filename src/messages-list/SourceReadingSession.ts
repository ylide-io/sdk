import { IListSource, IMessage } from '..';
import { Repository } from '../common/Repository';
import { BlockchainSourceType, IBlockchainSourceSubject } from './types/IBlockchainSourceSubject';
import { ListCache } from './mid-level/ListCache';
import { ListSource } from './mid-level/ListSource';
import { ListStorage } from './mid-level/ListStorage';

export class SourceReadingSession {
	public cacheRepository: Repository<IBlockchainSourceSubject, ListCache<IMessage>>;
	public storageRepository: Repository<IBlockchainSourceSubject, ListStorage<IMessage>>;
	public listSourceRepository: Repository<IBlockchainSourceSubject, IListSource>;

	constructor() {
		this.cacheRepository = new Repository<IBlockchainSourceSubject, ListCache<IMessage>>(
			this.sourceSubjectHash.bind(this),
		);
		this.storageRepository = new Repository<IBlockchainSourceSubject, ListStorage<IMessage>>(
			this.sourceSubjectHash.bind(this),
		);
		this.listSourceRepository = new Repository<IBlockchainSourceSubject, ListSource>(
			this.sourceSubjectHash.bind(this),
		);
	}

	public sourceSubjectHash(k: IBlockchainSourceSubject) {
		if (k.type === BlockchainSourceType.BROADCAST) {
			return `bc:${k.blockchain}:${k.id}:${k.feedId}:${k.sender || 'null'}`;
		} else {
			return `dm:${k.blockchain}:${k.id}:${k.recipient}:${k.sender || 'null'}`;
		}
	}

	getListSource(subject: IBlockchainSourceSubject): IListSource | null {
		return this.listSourceRepository.get(subject);
	}

	setListSource(subject: IBlockchainSourceSubject, source: IListSource) {
		this.listSourceRepository.set(subject, source);
	}
}
