/* eslint-disable no-debugger */
import { ListStorage } from './messages-list/mid-level/ListStorage';

const arrs: number[][] = [
	[6, 7, 8, 9],
	[14, 15, 16, 17],
	[24, 25, 26, 27],
	[34, 35, 36, 37],
];

const tests: [number[], number[][]][] = [
	[
		[1, 2, 3], // before 0 before 0
		[
			[1, 2, 3],
			[6, 7, 8, 9],
			[14, 15, 16, 17],
			[24, 25, 26, 27],
			[34, 35, 36, 37],
		],
	],
	[
		[4, 5, 6], // before 0 inside 0
		[
			[4, 5, 6, 7, 8, 9],
			[14, 15, 16, 17],
			[24, 25, 26, 27],
			[34, 35, 36, 37],
		],
	],
	[
		[5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38], // before 0 after
		[[5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38]],
	],
	[
		[8, 9, 10, 11], // inside 0 before 1
		[
			[6, 7, 8, 9, 10, 11],
			[14, 15, 16, 17],
			[24, 25, 26, 27],
			[34, 35, 36, 37],
		],
	],
	[
		[8, 9, 10, 14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38], // inside 0 after
		[[6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38]],
	],
	[
		[8, 9, 10, 13, 14, 15], // inside 0 inside 1
		[
			[6, 7, 8, 9, 10, 13, 14, 15, 16, 17],
			[24, 25, 26, 27],
			[34, 35, 36, 37],
		],
	],
	[
		[40, 41, 42], // after after
		[
			[6, 7, 8, 9],
			[14, 15, 16, 17],
			[24, 25, 26, 27],
			[34, 35, 36, 37],
			[40, 41, 42],
		],
	],
];

const test = async () => {
	for (const [arr, expected] of tests) {
		const t = new ListStorage<number>('test', (a, b) => b - a);
		// init:
		for (const arr2 of arrs) {
			await t.putObjects(arr2);
		}
		// test init:
		const res = t.segments.map(s => s.toArray());
		if (JSON.stringify(res) !== JSON.stringify(arrs)) {
			console.error('init failed');
			debugger;
			return;
		}
		// test put:
		debugger;
		await t.putObjects(arr);
		const res2 = t.segments.map(s => s.toArray());
		if (JSON.stringify(res2) !== JSON.stringify(expected)) {
			console.error('put failed: ', arr);
			debugger;
			return;
		}
	}
};

void test();
