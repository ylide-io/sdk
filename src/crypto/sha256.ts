import jssha256 from 'js-sha256';

export function sha256(data: string | Uint8Array): Uint8Array {
	return new Uint8Array(jssha256.sha256.digest(data));
}
