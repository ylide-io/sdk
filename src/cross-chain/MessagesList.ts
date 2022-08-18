import { AbstractBlockchainController } from '../abstracts';
import { IMessage } from '../types';
import { BlockchainSource, ISourceSubject } from './BlockchainSource';
import { GenericSortedMergedList } from './types/GenericSortedMergedList';

export class MessagesList extends GenericSortedMergedList<IMessage, BlockchainSource> {
	private drainers: {
		reader: AbstractBlockchainController;
		subject: ISourceSubject;
		source: BlockchainSource;
	}[] = [];

	addReader(reader: AbstractBlockchainController, subject: ISourceSubject) {
		const source = new BlockchainSource(reader, subject);
		this.drainers.push({ reader, subject, source });
		this.addSource(source);

		return source;
	}

	removeReader(reader: AbstractBlockchainController, subject: ISourceSubject) {
		const sourceIdx = this.drainers.findIndex(
			t => t.reader === reader && t.subject.type === subject.type && t.subject.address === subject.address,
		);
		if (sourceIdx === -1) {
			return;
		}
		const source = this.drainers[sourceIdx].source;
		this.drainers.splice(sourceIdx, 1);
		this.removeSource(source);
	}
}
