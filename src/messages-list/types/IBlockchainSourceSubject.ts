import { Uint256 } from '../../types';

export enum BlockchainSourceType {
	BROADCAST,
	DIRECT,
}

export type ISourceSubject =
	| {
			type: BlockchainSourceType.BROADCAST;
			feedId: Uint256;
			sender: string | null;
	  }
	| {
			type: BlockchainSourceType.DIRECT;
			recipient: Uint256;
			sender: string | null;
	  };

export type IBlockchainSourceSubject = ISourceSubject & {
	blockchain: string;
	id: string;
};
