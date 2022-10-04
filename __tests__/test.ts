import { CombinedList, GenericEntry, GenericEntryPure, GenericSortedMergedList, GenericSortedSource } from '.';
import { IExecutionFuture } from './cross-chain/types/ExecutionQueue';

const timelineA = [
	1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59,
	61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 99, 101, 103, 105, 107, 109, 111, 113,
	115, 117, 119, 121,
];
const timelineB = [
	2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60,
	62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114,
	116, 118, 120, 122,
];

const aCallbacksMessages: ((messages: GenericEntryPure<null>[]) => void)[] = [];
const aCallbacksMessage: ((message: GenericEntryPure<null>) => void)[] = [];
const bCallbacksMessages: ((messages: GenericEntryPure<null>[]) => void)[] = [];
const bCallbacksMessage: ((message: GenericEntryPure<null>) => void)[] = [];

const sourceA: GenericSortedSource<{ logIndex: number }> & { emit: any; inited: boolean } = {
	inited: false,
	init: async () => {
		// if (sourceA.inited) {
		// 	return;
		// } else {
		// 	sourceA.inited = true;
		// }
		// const messages = await sourceA.getLast(10);
		// if (messages.length) {
		// 	sourceA.emit('messages', { messages });
		// 	for (const message of messages) {
		// 		sourceA.emit('message', { message });
		// 	}
		// }
	},
	getBefore: async (entry, limit) =>
		timelineA
			.filter(e => e < entry.time)
			.map(t => ({ link: { logIndex: 0 }, time: t }))
			.sort((a, b) => b.time - a.time)
			.slice(0, limit),
	getLast: async (limit: number) =>
		timelineA
			.slice(timelineA.length - limit)
			.map(t => ({ link: { logIndex: 0 }, time: t }))
			.sort((a, b) => b.time - a.time),

	on: (event: 'messages' | 'message', callback) =>
		event === 'messages' ? aCallbacksMessages.push(callback as any) : aCallbacksMessage.push(callback as any),
	off: (event: 'messages' | 'message', callback) => null,

	emit: (event: 'messages' | 'message', data: any) => {
		if (event === 'messages') {
			aCallbacksMessages.forEach(c => c(data));
		} else {
			aCallbacksMessage.forEach(c => c(data));
		}
	},

	compare(a, b) {
		if (a.time === b.time) {
			return b.link.logIndex - a.link.logIndex;
		} else {
			return b.time - a.time;
		}
	},
};

const sourceB: GenericSortedSource<{ logicTime: number }> & { emit: any; inited: boolean } = {
	inited: false,
	init: async () => {
		// if (sourceB.inited) {
		// 	return;
		// } else {
		// 	sourceB.inited = true;
		// }
		// const messages = await sourceB.getLast(10);
		// if (messages.length) {
		// 	sourceB.emit('messages', { messages });
		// 	for (const message of messages) {
		// 		sourceB.emit('message', { message });
		// 	}
		// }
	},
	getBefore: async (entry, limit) =>
		timelineB
			.filter(e => e < entry.time)
			.map(t => ({ link: { logicTime: 0 }, time: t }))
			.sort((a, b) => b.time - a.time)
			.slice(0, limit),
	getLast: async (limit: number) =>
		timelineB
			.slice(timelineB.length - limit)
			.map(t => ({ link: { logicTime: 0 }, time: t }))
			.sort((a, b) => b.time - a.time),

	on: (event: 'messages' | 'message', callback) =>
		event === 'messages' ? bCallbacksMessages.push(callback as any) : bCallbacksMessage.push(callback as any),
	off: (event: 'messages' | 'message', callback) => null,

	emit: (event: 'messages' | 'message', data: any) => {
		if (event === 'messages') {
			bCallbacksMessages.forEach(c => c(data));
		} else {
			bCallbacksMessage.forEach(c => c(data));
		}
	},

	compare(a, b) {
		if (a.time === b.time) {
			return b.link.logicTime - a.link.logicTime;
		} else {
			return b.time - a.time;
		}
	},
};

const instance = new CombinedList<any, GenericSortedSource<any>>();

(async () => {
	const f = (result: IExecutionFuture<GenericEntry<any, GenericSortedSource<any>>[]>) => {
		if (result.type === 'success') {
			const res = result.result!;
			console.log(`${res.length} ${instance.isNextPageAvailable()} filtered:`, res.map(v => v.time).join(' '));
		} else {
			console.log('f: ', result.type);
		}
	};
	// ---------------------------------
	debugger;
	f(
		await instance.configure(m => {
			m.addSource(sourceA);
			m.setFilter(e => e.time % 3 === 0);
		}),
	);
	f(await instance.goNextPage());
	f(await instance.goNextPage());
	f(await instance.goNextPage());
	f(
		await instance.configure(m => {
			m.setPageSize(3);
			m.setFilter(e => e.time % 9 === 0);
		}),
	);
	f(await instance.goNextPage());
	f(
		await instance.configure(m => {
			m.addSource(sourceB);
			m.setPageSize(5);
		}),
	);
	f(await instance.goNextPage());
	f(await instance.goNextPage());
	debugger;
	// instance.on('windowUpdate', () => {
	// 	// console.log(
	// 	// 	'window: ',
	// 	// 	instance
	// 	// 		.getWindow()
	// 	// 		.map(t => t.time)
	// 	// 		.join(' '),
	// 	// );
	// });
	// f();
	// debugger;
	// sourceA.emit('messages', {
	// 	messages: [
	// 		{
	// 			time: 61,
	// 			link: { logIndex: 0 },
	// 		},
	// 	],
	// });
	// sourceA.emit('messages', {
	// 	messages: [
	// 		{
	// 			time: 61,
	// 			link: { logIndex: 1 },
	// 		},
	// 	],
	// });
	// f();
	// sourceA.emit('messages', {
	// 	messages: [
	// 		{
	// 			time: 57,
	// 			link: { logIndex: 1 },
	// 		},
	// 		{
	// 			time: 57,
	// 			link: { logIndex: 2 },
	// 		},
	// 		{
	// 			time: 57,
	// 			link: { logIndex: 4 },
	// 		},
	// 		{
	// 			time: 57,
	// 			link: { logIndex: 8 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 16 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 32 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 64 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 65 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 66 },
	// 		},
	// 		{
	// 			time: 59,
	// 			link: { logIndex: 67 },
	// 		},
	// 	],
	// });
	// f();
	// while (instance.isNextPageAvailable()) {
	// 	await instance.goNextPage();
	// }
	// f();
	// console.log('End');
	// debugger;
})();
