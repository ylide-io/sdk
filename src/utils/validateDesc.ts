import { AscComparator } from '../messages-list';

export const validateDesc = <T>(location: string, vals: T[], comparator: AscComparator<T>) => {
	for (let i = 1; i < vals.length; i++) {
		if (comparator(vals[i - 1], vals[i]) <= 0) {
			throw new Error(`${location}: Values are not sorted`);
		}
	}
};
