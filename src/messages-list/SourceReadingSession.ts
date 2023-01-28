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
			return `bc:${k.blockchain}:${k.id}:${k.sender}`;
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

	// listSources(subject: ISourceSubject, reader: AbstractBlockchainController): (ListSource | PuppetListSource)[] {

	// getBlockchainMessagesSource(subject: IBlockchainSourceSubject, reader: AbstractBlockchainController) {
	// 	return new BlockchainMessagesSource(reader, subject);
	// }

	// listSources(subject: ISourceSubject, reader: AbstractBlockchainController): (ListSource | PuppetListSource)[] {
	// 	if (
	// 		subject.type === BlockchainSourceType.BROADCAST ||
	// 		subject.sender === null ||
	// 		reader.isReadingBySenderAvailable()
	// 	) {
	// 		return (
	// 			this.listSourceRepository.get(subject) ||
	// 			this.listSourceRepository.set(
	// 				subject,
	// 				new ListSource(this, subject, this.getBlockchainMessagesSource(subject, reader)),
	// 			)
	// 		);
	// 	} else {
	// 		const originalListSource = this.listSource(
	// 			{
	// 				...subject,
	// 				sender: null,
	// 			},
	// 			reader,
	// 		) as ListSource;
	// 		return (
	// 			this.puppetListSourceRepository.get(subject) ||
	// 			this.puppetListSourceRepository.set(subject, new PuppetListSource(this, subject, originalListSource))
	// 		);
	// 	}
	// }
}
