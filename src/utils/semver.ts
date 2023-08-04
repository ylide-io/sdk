import { YlideMisusageError } from '../errors/YlideMisusageError';

import type { Semver } from '../primitives';

export const stringToSemver = (str: string): Semver => {
	if (!/^([0-9]|[1-9][0-9]*)((\.([0-9]|[1-9][0-9])){0,2})$/.test(str)) {
		throw new YlideMisusageError('Semver', `Invalid semver string: ${str}`);
	}
	const [major, minor, patch] = str.split('.');
	return {
		major: major ? parseInt(major, 10) : 0,
		minor: minor ? parseInt(minor, 10) : 0,
		patch: patch ? parseInt(patch, 10) : 0,
	};
};

export const semverToString = (semver: Semver): string => {
	return `${semver.major}.${semver.minor}.${semver.patch}`;
};
