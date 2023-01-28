import { AbstractBlockchainController } from '../abstracts';
import { IMessage } from '../types';
import { BlockchainSource, BlockchainSourceType, ISourceSubject } from './BlockchainSource';
import { CombinedList, GenericSortedSource, IConfigurationManager } from '../../__legacy/list/CombinedList';

export interface IMessagesListConfigurationManager
	extends IConfigurationManager<IMessage, GenericSortedSource<IMessage>> {
	addReader: (
		reader: AbstractBlockchainController,
		subject: ISourceSubject,
		pullPeriod: number,
		limit: number,
		meta: any,
	) => void;
	removeReader: (reader: AbstractBlockchainController, subject: ISourceSubject) => void;
}

export class MessagesList extends CombinedList<IMessage, GenericSortedSource<IMessage>> {
	private drainers: {
		reader: AbstractBlockchainController;
		subject: ISourceSubject;
		source: BlockchainSource;
	}[] = [];

	public async configure(configurer: (manager: IMessagesListConfigurationManager) => void) {
		return await super.configure(origManager => {
			configurer({
				...origManager,
				addReader: (
					reader: AbstractBlockchainController,
					subject: ISourceSubject,
					pullPeriod = 10000,
					limit = 50,
					meta: any = null,
				) => {
					const source = new BlockchainSource(reader, subject, pullPeriod, limit, meta);
					this.drainers.push({ reader, subject, source });
					origManager.addSource(source);
					return source;
				},
				removeReader: (reader: AbstractBlockchainController, subject: ISourceSubject) => {
					const sourceIdx = this.drainers.findIndex(
						t =>
							t.reader === reader &&
							t.subject.type === subject.type &&
							t.subject.sender === subject.sender &&
							((t.subject.type === BlockchainSourceType.DIRECT &&
								subject.type === BlockchainSourceType.DIRECT &&
								t.subject.recipient === subject.recipient) ||
								(t.subject.type = BlockchainSourceType.BROADCAST)),
					);
					if (sourceIdx === -1) {
						return;
					}
					const source = this.drainers[sourceIdx].source;
					this.drainers.splice(sourceIdx, 1);
					origManager.removeSource(source);
				},
			});
		});
	}

	// addReader(reader: AbstractBlockchainController, subject: ISourceSubject, pullPeriod: number = 10000) {
	// 	const source = new BlockchainSource(reader, subject, pullPeriod);
	// 	this.drainers.push({ reader, subject, source });
	// 	this.addSource(source);
	// 	return source;
	// }

	// removeReader(reader: AbstractBlockchainController, subject: ISourceSubject) {
	// 	const sourceIdx = this.drainers.findIndex(
	// 		t =>
	// 			t.reader === reader &&
	// 			t.subject.type === subject.type &&
	// 			t.subject.sender === subject.sender &&
	// 			((t.subject.type === BlockchainSourceType.DIRECT &&
	// 				subject.type === BlockchainSourceType.DIRECT &&
	// 				t.subject.recipient === subject.recipient) ||
	// 				(t.subject.type = BlockchainSourceType.BROADCAST)),
	// 	);
	// 	if (sourceIdx === -1) {
	// 		return;
	// 	}
	// 	const source = this.drainers[sourceIdx].source;
	// 	this.drainers.splice(sourceIdx, 1);
	// 	this.removeSource(source);
	// }
}
