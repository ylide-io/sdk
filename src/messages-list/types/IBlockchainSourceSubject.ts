import type { Uint256 } from '../../primitives';

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
			feedId: Uint256;
			recipient: Uint256;
			sender: string | null;
	  };

export type ILooseSourceSubject =
	| {
			type: BlockchainSourceType.BROADCAST;
			feedId: Uint256 | null;
			sender: string | null;
	  }
	| {
			type: BlockchainSourceType.DIRECT;
			feedId: Uint256 | null;
			recipient: Uint256 | null;
			sender: string | null;
	  };

export type IBlockchainSourceSubject = ISourceSubject & {
	blockchain: string;
	id: string;
};
