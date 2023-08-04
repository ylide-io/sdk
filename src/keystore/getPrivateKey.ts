import { YlidePrivateKeyHelper } from './YlidePrivateKeyHelper';

import { YlideError, YlideErrorType } from '../errors';
import { YlideMisusageError } from '../errors/YlideMisusageError';
import { YlideKeyVersion } from '../primitives';

export interface YlidePrivateKeyHandlers {
	onYlidePasswordRequest?: (address: string) => Promise<string | null>;
	onPrivateKeyRequest: (address: string, magicString: string) => Promise<Uint8Array | null>;
}

export const getPrivateKey = async (
	keyVersion: YlideKeyVersion,
	address: string,
	keyIndex: number,
	handlers: YlidePrivateKeyHandlers,
): Promise<{ privateKeyBytes: Uint8Array; password: null | string }> => {
	let magicString;
	let password: null | string = null;
	if (keyVersion === YlideKeyVersion.INSECURE_KEY_V1) {
		if (!handlers?.onYlidePasswordRequest) {
			throw new YlideMisusageError(
				'getPrivateKey',
				'Ylide password request handler is not set, but it is required for V1 version of YlideKey',
			);
		}
		const ylidePassword = await handlers.onYlidePasswordRequest(address);
		if (!ylidePassword) {
			throw new YlideError(YlideErrorType.WAS_CANCELLED, `Can't generate YlideKey V1 without Ylide password`);
		}
		password = ylidePassword;
		magicString = YlidePrivateKeyHelper.getMagicStringV1(address, keyIndex, ylidePassword);
	} else if (keyVersion === YlideKeyVersion.KEY_V2) {
		if (!handlers.onYlidePasswordRequest) {
			throw new YlideMisusageError(
				'getPrivateKey',
				'Ylide password request handler is not set, but it is required for V2 version of YlideKey',
			);
		}
		const ylidePassword = await handlers.onYlidePasswordRequest(address);
		if (!ylidePassword) {
			throw new YlideError(YlideErrorType.WAS_CANCELLED, `Can't generate YlideKey V2 without Ylide password`);
		}
		password = ylidePassword;
		magicString = YlidePrivateKeyHelper.getMagicStringV2(address, keyIndex, ylidePassword);
	} else if (keyVersion === YlideKeyVersion.KEY_V3) {
		magicString = YlidePrivateKeyHelper.getMagicStringV3(address, keyIndex);
	} else {
		throw new YlideMisusageError('getPrivateKey', `Unknown YlidePublicKey version: ${String(keyVersion)}`);
	}

	const privateKeyBytes = await handlers.onPrivateKeyRequest(address, magicString);

	if (!privateKeyBytes) {
		throw new YlideError(YlideErrorType.WAS_CANCELLED, `Can't get private key for YlideKey`);
	}

	return { privateKeyBytes, password };
};
