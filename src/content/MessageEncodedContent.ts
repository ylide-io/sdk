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
 * const { content: encodedContent, key } = MessageEncodedContent.encodeContent(messageContent);
 * // Content is bytes array with compressed and encrypted content. Key is a symmetric key which was used for encryption
 *
 * // Unpacking:
 * const decodedContent = MessageEncodedContent.decodeContent(encodedContent, key);
 * console.log('Your message: ', decodedContent);
 * ```
 */
export class MessageEncodedContent {
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
			encodedContent: symmetricEncrypt(packedBytes, key),
			key,
		};
	}

	static packRawContent(content: Uint8Array) {
		const packedBytes = this.pack(content);
		return {
			nonEncodedContent: packedBytes,
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

	static unpackRawContent(nonEncodedContent: Uint8Array) {
		return this.unpack(nonEncodedContent);
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
	 * @param encodedContent Raw encoded message content
	 * @param key Symmetric key used for encryption
	 * @returns Instance of `MessageContent` ancestor
	 */
	static decodeContent(encodedContent: Uint8Array, key: Uint8Array) {
		return this.messageContentFromBytes(this.decodeRawContent(encodedContent, key));
	}

	static packContent(content: MessageContent) {
		return this.packRawContent(this.messageContentToBytes(content));
	}

	static unpackContent(nonEncodedContent: Uint8Array) {
		return this.messageContentFromBytes(this.unpackRawContent(nonEncodedContent));
	}
}
