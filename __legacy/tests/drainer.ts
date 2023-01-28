/* eslint-disable */
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { ListStorage } from '../cross-chain/new-list/ListStorage';
import { LowLevelMessagesSource, ListSource } from '../cross-chain/new-list/ListSource';
import { AscComparator } from '../cross-chain/new-list/types/AscComparator';
import { IMessage, Uint256 } from '../types';
import { AsyncEventEmitter } from '../cross-chain/new-list/utils/AsyncEventEmitter';
import { EventEmitter } from 'eventemitter3';
import { ListSourceMultiplexer } from '../cross-chain/new-list/ListSourceMultiplexer';
import { SourceReadingSession } from '../cross-chain/new-list/SourceReadingSession';
import { BlockchainSourceType } from '../cross-chain';
import { ListSourceDrainer } from '../cross-chain/new-list/ListSourceDrainer';
import { asyncDelay } from '../utils/asyncDelay';
import { ScriptedSource, tou } from '../cross-chain/new-list/ScriptedSource';

function printListStorage(ls: ListStorage<number>) {
	console.log('-------------------------');
	for (const segment of ls.segments) {
		let s = ``;
		for (let c = segment.head(); c !== null; c = c.getNext()) {
			s += `${c !== segment.head() ? ', ' : ''}${c.getValue()}`;
		}
		console.log(`[${s}]`);
	}
}

function assertListStorage(ls: ListStorage<number>, result: number[][]) {
	expect(ls.segments.length).equal(result.length, 'Wrong segments count');
}

export function drainerTest() {
	describe('Drainer', () => {
		it('Simple - 1', async () => {
			const s = new SourceReadingSession();
			const a = new ScriptedSource('1 2 3 4 5 6', []);
			const list = new ListSource(
				s,
				{ type: BlockchainSourceType.DIRECT, recipient: tou('123'), sender: null, blockchain: 'A' },
				a,
			);
			const m = new ListSourceMultiplexer([list]);
			const d = new ListSourceDrainer(m);
			const firstPage = await d.resume();
			console.log('firstPage: ', firstPage);
			console.log('test: ', d.messages);
			const secondPage = await d.readMore(10);
			console.log('secondPage: ', secondPage);
			console.log('test: ', d.messages);
		});
	});
}
