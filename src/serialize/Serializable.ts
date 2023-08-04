import { YlideError, YlideErrorType } from '../errors';

import { SmartBuffer } from '@ylide/smart-buffer';

export const Serializable = <T>() => {
	abstract class SerializableInternal {
		abstract toBytes(): Uint8Array;

		toHex() {
			return new SmartBuffer(this.toBytes()).toHexString();
		}

		toBase64() {
			return new SmartBuffer(this.toBytes()).toBase64String();
		}

		static fromBytes(bytes: Uint8Array): T {
			throw new YlideError(YlideErrorType.NOT_IMPLEMENTED, 'Not implemented');
		}

		static fromHex(hex: string) {
			return this.fromBytes(SmartBuffer.ofHexString(hex).bytes);
		}

		static fromBase64(base64: string) {
			return this.fromBytes(SmartBuffer.ofBase64String(base64).bytes);
		}
	}
	return SerializableInternal;
};
