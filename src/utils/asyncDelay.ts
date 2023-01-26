export const asyncDelay = (time: number) => {
	return new Promise(resolve => setTimeout(resolve, time));
};
