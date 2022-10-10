import { listsTest } from './lists';

describe('Ylide', () => {
	listsTest();
});
// (async () => {
// 	const listStorage = new ListStorage<number>((a, b) => a - b);

// 	listStorage.put([9, 8, 7]);
// 	listStorage.put([4, 3, 2, 1]);
// 	listStorage.put([15, 14, 13, 12, 11]);

// 	listStorage.put([11, 10, 9, 8, 7]);

// 	printListStorage(listStorage);
// })();
