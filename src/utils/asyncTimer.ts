export default function asyncTimer(func: () => Promise<void>, time: number, preserveExecutionTime = true): () => void {
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
