import { deflate, inflate } from 'pako';

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
export class MessagePackedContent {
	/**
	 * Method to compress arbitrary bytes
	 *
	 * @param bytes Bytes you want to compress
	 * @returns Bytes of compression result
	 */
	static pack(bytes: Uint8Array): Uint8Array {
		return deflate(bytes);
	}

	/**
	 * Method to decompress bytes
	 *
	 * @param bytes Compressed bytes you want to decompress
	 * @returns Bytes of decompression result
	 */
	static unpack(bytes: Uint8Array): Uint8Array {
		return inflate(bytes);
	}
}
