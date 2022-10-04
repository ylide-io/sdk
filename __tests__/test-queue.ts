import { ExecutionQueue } from './cross-chain/types/ExecutionQueue';

(async () => {
	const queue = new ExecutionQueue<{ a: number; b: number }, number>(async ({ request }) => {
		await new Promise(resolve => setTimeout(resolve, 1000));
		return {
			type: 'success',
			error: null,
			result: request.a + request.b,
		};
	});

	const t1 = queue.execute({ a: 2, b: 3 });
	const t2 = queue.execute({ a: 4, b: 2 });
	const t3 = queue.execute({ a: 8, b: 9 });
	const t4 = queue.execute({ a: 1, b: 2 });
	const t5 = queue.execute({ a: 6, b: 0 });

	console.log('2 + 3', (await t1.promise).result);
	console.log('4 + 2', (await t2.promise).result);
	console.log('8 + 9', (await t3.promise).result);
	console.log('1 + 2', (await t4.promise).result);
	console.log('6 + 0', (await t5.promise).result);
})();
