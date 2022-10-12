/**
 * Helper to run async function periodically with the ability to preserve execution time
 * @param func Async function to run periodically
 * @param time Time between subsequent runs
 * @param preserveExecutionTime Should we exclude execution time from period time or not
 * @returns Function to dispose the timer
 */
export function asyncTimer(func: () => Promise<void>, time: number, preserveExecutionTime = true): () => void {
	if (!preserveExecutionTime) {
		const timerId = setInterval(func, time);
		return () => clearInterval(timerId);
	}
	let stop = false;
	let timer: NodeJS.Timeout | null;
	const processor = async () => {
		timer = null;
		try {
			await func();
		} catch (err) {
			//
		}
		if (!stop) {
			timer = setTimeout(processor, time);
		}
	};
	timer = setTimeout(processor, time);
	return () => {
		if (timer) {
			clearTimeout(timer);
		}
		stop = true;
	};
}
