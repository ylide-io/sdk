import { MessageContentV3 } from './MessageContentV3';
import pako from 'pako';
import nacl from 'tweetnacl';
import { symmetricDecrypt, symmetricEncrypt } from '../crypto/symmetric';
import { MessageContent } from '.';

/**
 * @category Content
 * @description Helper class to compress and encrypt message content
 * @example
 * ```ts
 * // Packing:
 *
 * const messageContent = MessageContentV3.plain('Hi there', 'Hello world everyone :)');
 * const { content: encodedContent, key } = MessageContainer.encodeContent(messageContent);
 * // Content is bytes array with compressed and encrypted content. Key is a symmetric key which was used for encryption
 *
 * // Unpacking:
 * const decodedContent = MessageContainer.decodeContent(encodedContent, key);
 * console.log('Your message: ', decodedContent);
 * ```
 */
export class MessageContainer {
	/**
	 * Method to compress arbitrary bytes
	 * @param bytes Bytes you want to compress
	 * @returns Bytes of compression result
	 */
	private static pack(bytes: Uint8Array): Uint8Array {
		return pako.deflate(bytes);
	}

	/**
	 * Method to decompress bytes
	 * @param bytes Compressed bytes you want to decompress
	 * @returns Bytes of decompression result
	 */
	private static unpack(bytes: Uint8Array): Uint8Array {
		return pako.inflate(bytes);
	}

	/**
	 * Method to encode (compress & encrypt) raw message content bytes
	 * @param content Bytes of the content you want to encode
	 * @returns Encoded content and key used for encryption
	 */
	static encodeRawContent(content: Uint8Array) {
		const packedBytes = this.pack(content);
		const key = nacl.randomBytes(32);
		return {
			content: symmetricEncrypt(packedBytes, key),
			key,
		};
	}

	/**
	 * Method to decode raw message content bytes
	 * @param content Encoded (compressed & encrypted) message content bytes
	 * @param key Symmetric key used for encryption
	 * @returns Decoded message content bytes
	 */
	static decodeRawContent(content: Uint8Array, key: Uint8Array) {
		const packedBytes = symmetricDecrypt(content, key);
		return this.unpack(packedBytes);
	}

	/**
	 * Method to get bytes of message content
	 * @param content `MessageContent` instance to convert into bytes
	 * @returns Raw bytes of message content
	 */
	static messageContentToBytes(content: MessageContent) {
		return content.toBytes();
	}

	/**
	 * Method to get message content instance from raw message content bytes
	 * @param bytes Raw bytes of message content
	 * @returns Instance of `MessageContent` ancestor
	 */
	static messageContentFromBytes(bytes: Uint8Array) {
		if (bytes.length && bytes[0] === 0x03) {
			return MessageContentV3.fromBytes(bytes);
		} else {
			throw new Error('Unsupported message content version');
		}
	}

	/**
	 * Method to encode `MessageContent` instance
	 * @param content `MessageContent` instance
	 * @returns Bytes of encoded message
	 */
	static encodeContent(content: MessageContent) {
		return this.encodeRawContent(this.messageContentToBytes(content));
	}

	/**
	 * Method to decode raw message content bytes into `MessageContent` instance
	 * @param content Raw encoded message content
	 * @param key Symmetric key used for encryption
	 * @returns Instance of `MessageContent` ancestor
	 */
	static decodeContent(content: Uint8Array, key: Uint8Array) {
		return this.messageContentFromBytes(this.decodeRawContent(content, key));
	}
}
