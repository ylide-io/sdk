import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { ListStorage } from '../cross-chain/new-list/ListStorage';

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
		let listStorage: ListStorage<number>;
		beforeEach(async () => {
			listStorage = new ListStorage<number>((a, b) => a - b);
		});
		it('One segment', async () => {
			await listStorage.putObjects([3, 2, 1]);
			assertListStorage(listStorage, [[3, 2, 1]]);
		});
		it('Two segment', async () => {
			await listStorage.putObjects([3, 2, 1]);
			await listStorage.putObjects([9, 8, 7]);
			assertListStorage(listStorage, [
				[9, 8, 7],
				[3, 2, 1],
			]);
		});
		it('Two segment desc order', async () => {
			await listStorage.putObjects([9, 8, 7]);
			await listStorage.putObjects([3, 2, 1]);
			assertListStorage(listStorage, [
				[9, 8, 7],
				[3, 2, 1],
			]);
		});
		it('Two segments overlap', async () => {
			await listStorage.putObjects([9, 8, 7, 3]);
			await listStorage.putObjects([3, 2, 1]);
			assertListStorage(listStorage, [[9, 8, 7, 3, 2, 1]]);
		});
		it('Two segments huge overlap', async () => {
			await listStorage.putObjects([9, 8, 7, 6, 5, 4, 3]);
			await listStorage.putObjects([5, 4, 3, 2, 1]);
			assertListStorage(listStorage, [[9, 8, 7, 6, 5, 4, 3, 2, 1]]);
		});
		it('Two segments huge overlap asc order', async () => {
			await listStorage.putObjects([5, 4, 3, 2, 1]);
			await listStorage.putObjects([9, 8, 7, 6, 5, 4, 3]);
			assertListStorage(listStorage, [[9, 8, 7, 6, 5, 4, 3, 2, 1]]);
		});
		it('Two segments ends overlap', async () => {
			await listStorage.putObjects([3, 2, 1]);
			await listStorage.putObjects([5, 4, 3]);
			assertListStorage(listStorage, [[5, 4, 3, 2, 1]]);
		});
		it('Two segments ends overlap desc order', async () => {
			await listStorage.putObjects([5, 4, 3]);
			await listStorage.putObjects([3, 2, 1]);
			assertListStorage(listStorage, [[5, 4, 3, 2, 1]]);
		});
		it('Four non-overlapping segments', async () => {
			await listStorage.putObjects([20, 19, 18, 17]);
			await listStorage.putObjects([15, 14, 13, 12]);
			await listStorage.putObjects([10, 9, 8, 7]);
			await listStorage.putObjects([5, 4, 3, 2]);
			assertListStorage(listStorage, [
				[20, 19, 18, 17],
				[15, 14, 13, 12],
				[10, 9, 8, 7],
				[5, 4, 3, 2],
			]);
		});
		it('Four non-overlapping segments random order', async () => {
			await listStorage.putObjects([10, 9, 8, 7]);
			await listStorage.putObjects([15, 14, 13, 12]);
			await listStorage.putObjects([5, 4, 3, 2]);
			await listStorage.putObjects([20, 19, 18, 17]);
			assertListStorage(listStorage, [
				[20, 19, 18, 17],
				[15, 14, 13, 12],
				[10, 9, 8, 7],
				[5, 4, 3, 2],
			]);
		});
		describe('FNOS', async () => {
			beforeEach(async () => {
				await listStorage.putObjects([20, 19, 18, 17]);
				await listStorage.putObjects([15, 14, 13, 12]);
				await listStorage.putObjects([10, 9, 8, 7]);
				await listStorage.putObjects([5, 4, 3, 2]);
			});
			it('First before 0, last before, no contained', async () => {
				await listStorage.putObjects([25, 24, 23, 22]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22],
					[20, 19, 18, 17],
					[15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 0, last inside, no contained', async () => {
				await listStorage.putObjects([25, 24, 23, 22, 21, 20, 19]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22, 21, 20, 19, 18, 17],
					[15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 0, last before, contained 1', async () => {
				await listStorage.putObjects([25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 0, last before, contained 2', async () => {
				await listStorage.putObjects([25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 0, last inside, contained 2', async () => {
				await listStorage.putObjects([25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 0, last after', async () => {
				await listStorage.putObjects([
					25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
				]);
				assertListStorage(listStorage, [
					[25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
				]);
			});
			it('First before 2, last before 2', async () => {
				await listStorage.putObjects([29, 28, 27, 26]);
				await listStorage.putObjects([24, 23, 22]);
				assertListStorage(listStorage, [
					[29, 28, 27, 26],
					[24, 23, 22],
					[20, 19, 18, 17],
					[15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First before 2, last inside 3', async () => {
				await listStorage.putObjects([29, 28, 27, 26]);
				await listStorage.putObjects([24, 23, 22, 21, 20]);
				assertListStorage(listStorage, [
					[29, 28, 27, 26],
					[24, 23, 22, 21, 20, 19, 18, 17],
					[15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First inside, last inside', async () => {
				await listStorage.putObjects([13, 12, 11, 10, 9]);
				assertListStorage(listStorage, [
					[20, 19, 18, 17],
					[15, 14, 13, 12, 11, 10, 9, 8, 7],
					[5, 4, 3, 2],
				]);
			});
			it('First inside, last after', async () => {
				await listStorage.putObjects([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
				assertListStorage(listStorage, [
					[20, 19, 18, 17],
					[15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
				]);
			});
			it('First before 2, last after', async () => {
				await listStorage.putObjects([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
				assertListStorage(listStorage, [
					[20, 19, 18, 17],
					[15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
				]);
			});
			it('First after, last after', async () => {
				await listStorage.putObjects([1, 0, -1, -2, -3]);
				assertListStorage(listStorage, [
					[20, 19, 18, 17],
					[15, 14, 13, 12],
					[10, 9, 8, 7],
					[5, 4, 3, 2],
					[1, 0, -1, -2, -3],
				]);
			});
		});
	});
}
