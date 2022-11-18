import { AbstractBlockchainController } from '../../abstracts';
import { IndexerHub } from '../../indexer/IndexerHub';
import { IMessage } from '../../types';
import { BlockchainSource, BlockchainSourceType } from '../BlockchainSource';
import { BlockchainListSource } from './BlockchainListSource';
import { IndexerListSource } from './IndexerListSource';
import { ListCache } from './ListCache';
import { GenericListSource, ListSource } from './ListSource';
import { ListStorage } from './ListStorage';
import { PuppetListSource } from './PuppetListSource';
import { Repository } from './Repository';
import { IBlockchainSourceSubject } from './types/IBlockchainSourceSubject';

export class SourceReadingSession {
	indexerHub: IndexerHub = new IndexerHub();
	//
	cacheRepository = new Repository<IBlockchainSourceSubject, ListCache<IMessage>>(this.sourceSubjectHash.bind(this));
	storageRepository = new Repository<IBlockchainSourceSubject, ListStorage<IMessage>>(
		this.sourceSubjectHash.bind(this),
	);
	listSourceRepository = new Repository<IBlockchainSourceSubject, ListSource>(this.sourceSubjectHash.bind(this));
	puppetListSourceRepository = new Repository<IBlockchainSourceSubject, PuppetListSource>(
		this.sourceSubjectHash.bind(this),
	);

	constructor() {
		//
	}

	sourceOptimizer:
		| null
		| ((subject: IBlockchainSourceSubject, reader: AbstractBlockchainController) => GenericListSource | null) =
		null;

	sourceSubjectHash(k: IBlockchainSourceSubject) {
		if (k.type === BlockchainSourceType.BROADCAST) {
			return `bc:${k.blockchain}:${k.sender}`;
		} else {
			return `dm:${k.blockchain}:${k.sender}:${k.recipient}`;
		}
	}

	getBlockchainListSource(subject: IBlockchainSourceSubject, reader: AbstractBlockchainController) {
		const source = this.sourceOptimizer ? this.sourceOptimizer(subject, reader) : null;
		return source ? source : new BlockchainListSource(reader, subject);
	}

	listSource(subject: IBlockchainSourceSubject, reader: AbstractBlockchainController): ListSource | PuppetListSource {
		if (
			subject.type === BlockchainSourceType.BROADCAST ||
			subject.sender === null ||
			reader.isReadingBySenderAvailable()
		) {
			return (
				this.listSourceRepository.get(subject) ||
				this.listSourceRepository.set(
					subject,
					new ListSource(this, subject, this.getBlockchainListSource(subject, reader)),
				)
			);
		} else {
			const originalListSource = this.listSource(
				{
					...subject,
					sender: null,
				},
				reader,
			) as ListSource;
			return (
				this.puppetListSourceRepository.get(subject) ||
				this.puppetListSourceRepository.set(subject, new PuppetListSource(this, subject, originalListSource))
			);
		}
	}
}
