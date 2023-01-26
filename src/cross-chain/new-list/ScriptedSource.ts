import EventEmitter from 'eventemitter3';
import { IMessage, Uint256 } from '../../types';
import { asyncDelay } from '../../utils/asyncDelay';
import { asyncTimer } from '../../utils/asyncTimer';
import { GenericListSource } from './ListSource';
import { AscComparator } from './types/AscComparator';

export const tou = (arg0: string): Uint256 => {
	return arg0 as Uint256;
};

const m = (n: number): IMessage => {
	return {
		isBroadcast: false,

		msgId: `MM${n}`,

		createdAt: n,
		senderAddress: n % 10 === 0 ? '456' : '789',
		recipientAddress: tou('recipient'),
		blockchain: 'blockchain',

		key: new Uint8Array(),

		$$meta: null,
	};
};

export class ScriptedSource extends EventEmitter implements GenericListSource {
	public _isPaused = true;
	public sinceMessagesIdx = 0;
	public messagesScript: number[];
	public newMessagesScript: { delay: number; vals: number[] }[];
	public pullTimer: (() => void) | null = null;

	private log(...args: any[]) {
		// console.log('SS: ', ...args);
	}

	compare: AscComparator<IMessage> = (a: IMessage, b: IMessage) => {
		return a.createdAt - b.createdAt;
	};

	async playNewMessages() {
		for (const nm of this.newMessagesScript) {
			await asyncDelay(nm.delay);
			this.messagesScript.unshift(...nm.vals);
			this.sinceMessagesIdx += nm.vals.length;
			this.log('new msgs put: ', nm.vals);
		}
	}

	async getAfter(entry: IMessage, limit: number): Promise<IMessage[]> {
		return [];
	}

	async getBefore(entry: IMessage, limit: number): Promise<IMessage[]> {
		this.log('getBefore start');
		const idx = this.messagesScript.indexOf(entry.createdAt) + 1;
		const res: IMessage[] = [];
		for (let i = idx; i < this.messagesScript.length && res.length < limit; i++) {
			const curr = this.messagesScript[i];
			if (curr < 0) {
				await asyncDelay(curr);
			} else {
				res.push(m(curr));
			}
		}
		this.log(
			'getBefore end: ',
			res.map(r => r.createdAt),
		);
		return res;
	}

	async getLast(limit: number): Promise<IMessage[]> {
		this.log('getLast start');
		const idx = 0;
		const res: IMessage[] = [];
		for (let i = idx; i < this.messagesScript.length && res.length < limit; i++) {
			const curr = this.messagesScript[i];
			if (curr < 0) {
				await asyncDelay(curr);
			} else {
				res.push(m(curr));
			}
		}
		this.log(
			'getLast end: ',
			res.map(r => r.createdAt),
		);
		return res;
	}

	resume(since?: IMessage): void {
		this.log('resume: ', since);
		if (since) {
			const idx = this.messagesScript.indexOf(since.createdAt);
			if (idx < 0) {
				// eslint-disable-next-line no-debugger
				debugger;
			} else {
				this.sinceMessagesIdx = idx;
			}
		}
		if (!this.pullTimer) {
			this.pullTimer = asyncTimer(this.pull.bind(this), 1000);
		}
	}

	async pull() {
		this.log('pull: ', this.sinceMessagesIdx);
		const nm = this.messagesScript.slice(0, this.sinceMessagesIdx);
		this.sinceMessagesIdx = 0;
		if (nm.length > 0) {
			this.log(
				'pull: ',
				nm.filter(d => d >= 0),
			);
			this.emit('messages', { messages: nm.filter(d => d >= 0).map(v => m(v)) });
		}
	}

	pause(): void {
		this.log('pause');
		if (this.pullTimer) {
			this.pullTimer();
		}
	}

	constructor(messagesArchive: string, newMessages: { delay: number; vals: number[] }[]) {
		super();
		this.messagesScript = messagesArchive.split(' ').map(t => parseInt(t, 10));
		this.newMessagesScript = newMessages;
		void this.playNewMessages();
	}
}
