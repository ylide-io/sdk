import { GenericEntryPure, GenericSortedMergedList, GenericSortedSource } from '../../src';

const timelineA = [
	1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59,
];
const timelineB = [
	2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60,
];

const aCallbacksMessages: ((messages: GenericEntryPure<null>[]) => void)[] = [];
const aCallbacksMessage: ((message: GenericEntryPure<null>) => void)[] = [];
const bCallbacksMessages: ((messages: GenericEntryPure<null>[]) => void)[] = [];
const bCallbacksMessage: ((message: GenericEntryPure<null>) => void)[] = [];

const sourceA: GenericSortedSource<{ logIndex: number }> & { emit: any } = {
	getAfter: async (entry, limit) =>
		timelineA
			.filter(e => e < entry.time)
			.map(t => ({ link: { logIndex: 0 }, time: t }))
			.slice(-limit)
			.sort((a, b) => b.time - a.time),
	getBefore: async (entry, limit) =>
		timelineA
			.filter(e => e > entry.time)
			.map(t => ({ link: { logIndex: 0 }, time: t }))
			.slice(0, limit)
			.sort((a, b) => b.time - a.time),
	getLast: async (limit: number) =>
		timelineA.slice(timelineA.length - limit).map(t => ({ link: { logIndex: 0 }, time: t })),

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

	cmpr(a, b) {
		if (a.time === b.time) {
			return b.link.logIndex - a.link.logIndex;
		} else {
			return b.time - a.time;
		}
	},
};

const sourceB: GenericSortedSource<{ logicTime: number }> & { emit: any } = {
	getAfter: async (entry, limit) =>
		timelineB
			.filter(e => e < entry.time)
			.map(t => ({ link: { logicTime: 0 }, time: t }))
			.slice(-limit)
			.sort((a, b) => b.time - a.time),
	getBefore: async (entry, limit) =>
		timelineB
			.filter(e => e > entry.time)
			.map(t => ({ link: { logicTime: 0 }, time: t }))
			.slice(0, limit)
			.sort((a, b) => b.time - a.time),
	getLast: async (limit: number) =>
		timelineB.slice(timelineB.length - limit).map(t => ({ link: { logicTime: 0 }, time: t })),

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

	cmpr(a, b) {
		if (a.time === b.time) {
			return b.link.logicTime - a.link.logicTime;
		} else {
			return b.time - a.time;
		}
	},
};

const instance = new GenericSortedMergedList<any>();
instance.addSource(sourceA);
instance.addSource(sourceB);

(async () => {
	instance.on('windowUpdate', () => {
		console.log(
			'window: ',
			instance
				.getWindow()
				.map(t => t.time)
				.join(' '),
		);
	});

	await instance.readFirstPage();
	sourceA.emit('messages', [
		{
			time: 61,
			link: { logIndex: 0 },
		},
	]);
	while (instance.isNextPageAvailable()) {
		await instance.goNextPage();
	}
	console.log('End');
	sourceA.emit('messages', [
		{
			time: 61,
			link: { logIndex: 1 },
		},
	]);
	while (instance.isPreviousPageAvailable()) {
		await instance.goPreviousPage();
	}
	sourceA.emit('messages', [
		{
			time: 59,
			link: { logIndex: 1 },
		},
		{
			time: 59,
			link: { logIndex: 2 },
		},
		{
			time: 59,
			link: { logIndex: 4 },
		},
		{
			time: 59,
			link: { logIndex: 8 },
		},
		{
			time: 59,
			link: { logIndex: 16 },
		},
		{
			time: 59,
			link: { logIndex: 32 },
		},
		{
			time: 59,
			link: { logIndex: 64 },
		},
		{
			time: 59,
			link: { logIndex: 65 },
		},
		{
			time: 59,
			link: { logIndex: 66 },
		},
		{
			time: 59,
			link: { logIndex: 67 },
		},
	]);
	while (instance.isNextPageAvailable()) {
		await instance.goNextPage();
	}
	console.log('End');
	while (instance.isPreviousPageAvailable()) {
		await instance.goPreviousPage();
	}
	debugger;
})();
