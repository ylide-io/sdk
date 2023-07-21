import { AscComparator } from '../messages-list';

export const validateDesc = <T>(location: string, vals: T[], comparator: AscComparator<T>) => {
	for (let i = 1; i < vals.length; i++) {
		const cmpr = comparator(vals[i - 1], vals[i]);
		if (cmpr <= 0) {
			console.log(`Cmpr for `, vals[i - 1], vals[i], cmpr);
			throw new Error(`${location}: Values are not sorted:\n` + `${JSON.stringify(vals)}`);
		}
	}
};
