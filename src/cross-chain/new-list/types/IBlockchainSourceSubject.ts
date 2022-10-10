import { ISourceSubject } from '../../BlockchainSource';

export type IBlockchainSourceSubject = ISourceSubject & {
	blockchain: string;
};
