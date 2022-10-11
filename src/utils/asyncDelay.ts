export function asyncDelay(time: number) {
	return new Promise(resolve => setTimeout(resolve, time));
}
