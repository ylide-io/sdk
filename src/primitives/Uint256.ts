import { YlideMisusageError } from '../errors/YlideMisusageError';

import { SmartBuffer } from '@ylide/smart-buffer';

export type Uint256 = string & { __magic: true }; // 32-bytes hex string

export const isUint256 = (t: any): t is Uint256 => {
	if (typeof t === 'string' && t.length === 64) {
		return /[0-9a-f]{64}/g.test(t);
	} else {
		return false;
	}
};

export const hexToUint256 = (hex: string): Uint256 => {
	if (hex.startsWith('0x')) {
		const raw = hex.substring(2).toLowerCase();
		if (!isUint256(raw)) {
			throw new YlideMisusageError('Uint256', 'This hex is not 64-symbols hex string');
		}
		return raw;
	} else {
		const lc = hex.toLowerCase();
		if (!isUint256(lc)) {
			throw new YlideMisusageError('Uint256', 'This hex is not 64-symbols hex string');
		}
		return lc;
	}
};

export const uint8ArrayToUint256 = (a: Uint8Array): Uint256 => {
	if (a.length !== 32) {
		throw new YlideMisusageError('Uint256', 'Uint256 is 32 bytes long');
	}
	return new SmartBuffer(a).toHexString().padStart(64, '0') as Uint256;
};

export const bigIntToUint256 = (a: string): Uint256 => {
	const bi = BigInt(a).toString(16);
	if (bi.length > 64) {
		throw new YlideMisusageError('Uint256', 'Uint256 is 32 bytes long, cannot fit this big int');
	}
	return bi.padStart(64, '0') as Uint256;
};

export const uint256ToHex = (val: Uint256): string => {
	return val;
};

export const uint256ToUint8Array = (val: Uint256) => {
	return SmartBuffer.ofHexString(val).bytes;
};
