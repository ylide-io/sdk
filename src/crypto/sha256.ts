import jssha256 from 'js-sha256';

/**
 * Method to calculate SHA256 hash of the arbitrary data (bytes array or string)
 * @param data Data to calculate hash
 * @returns 32-bytes array with the SHA256 hash of the data
 */
export function sha256(data: string | Uint8Array): Uint8Array {
	return new Uint8Array(jssha256.sha256.digest(data));
}
