import { Uint256 } from '../../types';

export enum BlockchainSourceType {
	BROADCAST,
	DIRECT,
}

export type ISourceSubject =
	| {
			type: BlockchainSourceType.BROADCAST;
			sender: string;
	  }
	| {
			type: BlockchainSourceType.DIRECT;
			sender: string | null;
			recipient: Uint256;
	  };

export type IBlockchainSourceSubject = ISourceSubject & {
	blockchain: string;
	id: string;
};
