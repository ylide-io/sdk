import { Semver } from '../types';

export const stringToSemver = (str: string): Semver => {
	if (!/^([0-9]|[1-9][0-9]*)((\.([0-9]|[1-9][0-9])){0,2})$/.test(str)) {
		throw new Error(`Invalid semver string: ${str}`);
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
