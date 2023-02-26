import { Uint256 } from '../../types';

export enum BlockchainSourceType {
	BROADCAST,
	DIRECT,
}

export type ISourceSubject =
	| {
			namespace?: string;
			type: BlockchainSourceType.BROADCAST;
			feedId: Uint256;
			sender: string | null;
	  }
	| {
			namespace?: string;
			type: BlockchainSourceType.DIRECT;
			recipient: Uint256;
			sender: string | null;
	  };

export type IBlockchainSourceSubject = ISourceSubject & {
	blockchain: string;
	id: string;
};
