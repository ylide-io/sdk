import { symmetricDecrypt, symmetricEncrypt } from '../crypto';

import nacl from 'tweetnacl';

export class MessageSecureContext {
	constructor(public readonly key: Uint8Array) {}

	static create() {
		const key = nacl.randomBytes(32);
		return new MessageSecureContext(key);
	}

	encrypt(content: Uint8Array) {
		return symmetricEncrypt(content, this.key);
	}

	decrypt(content: Uint8Array) {
		return symmetricDecrypt(content, this.key);
	}
}
