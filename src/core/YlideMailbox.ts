import { YlideCore } from './YlideCore';

import { YlideMisusageError } from '../errors/YlideMisusageError';
import { BlockchainSourceType } from '../messages-list/types/IBlockchainSourceSubject';
import { ListSourceMultiplexer } from '../messages-list/high-level/ListSourceMultiplexer';
import { SourceReadingSession } from '../messages-list/SourceReadingSession';
import { ListSourceDrainer } from '../messages-list/high-level/ListSourceDrainer';
import { YLIDE_MAIN_FEED_ID } from '../utils/constants';
import { YlideError, YlideErrorType } from '../errors';

import type { IMessageContent } from '../primitives/IMessage';
import type { Uint256 } from '../primitives/Uint256';
import type { WalletAccount } from '../primitives/WalletAccount';
import type { IMessageWithSource } from '../messages-list/high-level/ListSourceMultiplexer';
import type { Ylide } from '../Ylide';

export class YlideMailbox {
	private readingSession: SourceReadingSession;

	constructor(public readonly ylide: Ylide) {
		this.readingSession = new SourceReadingSession();
	}

	private getSourcesForAccount(account: WalletAccount, isSent: boolean, feedId: Uint256) {
		const wallet = this.ylide.controllers.wallets.find(w => w.wallet() === account.wallet);
		if (!wallet) {
			throw new YlideMisusageError('YlideMailbox', `Wallet ${account.wallet} not found`);
		}
		return this.ylide.core
			.getListSources(this.readingSession, [
				{
					feedId,
					type: BlockchainSourceType.DIRECT,
					recipient: isSent
						? YlideCore.getSentAddress(wallet.addressToUint256(account.address))
						: wallet.addressToUint256(account.address),
					sender: null,
				},
			])
			.map(source => ({ source, meta: { account } }));
	}

	private getSources(accounts: WalletAccount[], isSent: boolean, feedId: Uint256 = YLIDE_MAIN_FEED_ID) {
		const sources = [];
		for (const account of accounts) {
			sources.push(...this.getSourcesForAccount(account, isSent, feedId));
		}
		return sources;
	}

	async inbox(
		accounts: WalletAccount[],
		options: {
			feedId: Uint256;
			filter: null | ((m: IMessageWithSource) => void);
			onNewMessages: null | (() => void);
		} = {
			feedId: YLIDE_MAIN_FEED_ID,
			filter: null,
			onNewMessages: null,
		},
	) {
		const list = new ListSourceDrainer(new ListSourceMultiplexer(this.getSources(accounts, false, options.feedId)));
		const { dispose } = await list.connect(() => (options.onNewMessages ? options.onNewMessages() : null));
		// await list.resetFilter(options.filter);

		return { list, dispose };
	}

	async sent(
		accounts: WalletAccount[],
		options: {
			feedId: Uint256;
			filter: null | ((m: IMessageWithSource) => void);
			onNewMessages: null | (() => void);
		} = {
			feedId: YLIDE_MAIN_FEED_ID,
			filter: null,
			onNewMessages: null,
		},
	) {
		const list = new ListSourceDrainer(new ListSourceMultiplexer(this.getSources(accounts, true, options.feedId)));
		const { dispose } = await list.connect(() => (options.onNewMessages ? options.onNewMessages() : null));
		await list.resetFilter(options.filter);

		return { list, dispose };
	}

	async content(m: IMessageWithSource) {
		return await this.ylide.core.getMessageContent(m.msg);
	}

	async decrypt(m: IMessageWithSource, content?: IMessageContent) {
		if (!content) {
			const newContent = await this.content(m);
			if (!newContent || newContent.corrupted) {
				throw new YlideError(YlideErrorType.NOT_FOUND, 'Message content not found or corrupted');
			}
			content = newContent;
		}
		return await this.ylide.core.decryptMessageContent(m.meta.account, m.msg, content);
	}
}
