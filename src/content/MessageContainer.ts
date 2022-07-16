import { MessageContentV3 } from './MessageContentV3';
import pako from 'pako';
import nacl from 'tweetnacl';
import { symmetricDecrypt, symmetricEncrypt } from '../crypto/symmetric';
import { MessageContent } from '.';

export class MessageContainer {
	private static pack(bytes: Uint8Array): Uint8Array {
		return pako.deflate(bytes);
	}

	private static unpack(bytes: Uint8Array): Uint8Array {
		return pako.inflate(bytes);
	}

	static encodeRawContent(content: Uint8Array) {
		const packedBytes = this.pack(content);
		const key = nacl.randomBytes(32);
		return {
			content: symmetricEncrypt(packedBytes, key),
			key,
		};
	}

	static decodeRawContent(content: Uint8Array, key: Uint8Array) {
		const packedBytes = symmetricDecrypt(content, key);
		return this.unpack(packedBytes);
	}

	static messageContentToBytes(content: MessageContent) {
		return content.toBytes();
	}

	static messageContentFromBytes(bytes: Uint8Array) {
		if (bytes.length && bytes[0] === 0x03) {
			return MessageContentV3.fromBytes(bytes);
		} else {
			throw new Error('Unsupported message content version');
		}
	}

	static encodeContent(content: MessageContent) {
		return this.encodeRawContent(this.messageContentToBytes(content));
	}

	static decodeContent(content: Uint8Array, key: Uint8Array) {
		return this.messageContentFromBytes(this.decodeRawContent(content, key));
	}
}
