import { AbstractBlockchainController } from '../abstracts';
import { IMessage, Uint256 } from '../types';
import { BlockchainSource, BlockchainSourceSubjectType, ISourceSubject } from './BlockchainSource';
import { GenericSortedMergedList } from './types/GenericSortedMergedList';

export class MessagesList extends GenericSortedMergedList<IMessage> {
	private drainers: {
		reader: AbstractBlockchainController;
		mailerAddress: string | undefined;
		subject: ISourceSubject;
		source: BlockchainSource;
	}[] = [];

	addReader(
		reader: AbstractBlockchainController,
		mailerAddress: string | undefined = undefined,
		subject: ISourceSubject,
	) {
		const source = new BlockchainSource(reader, mailerAddress, subject);
		this.drainers.push({ reader, mailerAddress, subject, source });
		this.addSource(source);

		return source;
	}

	removeReader(
		reader: AbstractBlockchainController,
		mailerAddress: string | undefined = undefined,
		subject: ISourceSubject,
	) {
		const source = this.drainers.find(
			t =>
				t.reader === reader &&
				t.mailerAddress === mailerAddress &&
				t.subject.type === subject.type &&
				t.subject.address === subject.address,
		)?.source;
		if (!source) {
			return;
		}
		this.removeSource(source);
	}
}
