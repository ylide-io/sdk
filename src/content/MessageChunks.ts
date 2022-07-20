import SmartBuffer from '@ylide/smart-buffer';

/**
 * @category Content
 * @description Internal helper class to pack content into container and split it into chunks (for blockchains with transaction size limit)
 * @example
 * ```ts
 * // Packing:
 *
 * const messageContent = MessageContentV3.plain('Hi there', 'Hello world everyone :)');
 * const bytes = messageContent.toBytes();
 * const chunks = MessageChunks.packContentInChunks(YLIDE_SC, senderPublicKey, bytes);
 * // Broadcast chunks through blockchain
 *
 * // Unpacking:
 * const chunks: Uint8Array[] = await readChunksFromSomewhere();
 * const content = MessageChunks.unpackContentFromChunks(chunks);
 * console.log('Your message: ', content);
 * ```
 */
export class MessageChunks {
	static VERSION = 0x04;

	/**
	 * Helper method to split long bytes array into smaller ones
	 * @param bytes Original bytes array
	 * @param chunkSize Max size of one chunk
	 * @returns Bytes splitted into chunks, each chunk is less or equal `chunkSize`
	 */
	static splitMessageChunks(bytes: Uint8Array, chunkSize = 15 * 1024): Uint8Array[] {
		const chunks: Uint8Array[] = [];
		for (let offset = 0; offset < bytes.length; offset += chunkSize) {
			const chunk = bytes.slice(offset, offset + chunkSize);
			chunks.push(chunk);
		}
		return chunks;
	}

	/**
	 * Method to prepare outgoing message for publishing to blockchain
	 *
	 * @param serviceCode Service code of an app used to send message. Used for analytics, could be left zero-filled.
	 * @param publicKey Public key of message sender
	 * @param content Content of the message (usually the result of `MessageContent.toBytes()`)
	 * @param chunkSize Max size of one chunk
	 * @returns Wrapped content splet into chunks
	 */
	static packContentInChunks(
		serviceCode: [number, number, number, number],
		publicKey: Uint8Array,
		content: Uint8Array,
		chunkSize = 15 * 1024,
		isNative = false,
	) {
		const buf = SmartBuffer.ofSize(1 + 4 + 1 + 1 + publicKey.length + 4 + content.length);
		buf.writeUint8(this.VERSION);
		buf.writeUint8(serviceCode[0]);
		buf.writeUint8(serviceCode[1]);
		buf.writeUint8(serviceCode[2]);
		buf.writeUint8(serviceCode[3]);
		buf.writeUint8(isNative ? 1 : 0);
		buf.writeBytes8Length(publicKey);
		buf.writeBytes32Length(content);
		return this.splitMessageChunks(buf.bytes, chunkSize);
	}

	/**
	 * Method to retrieve message content and metadata from containers' chunks
	 *
	 * @param chunks Chunks of the message (usually read from blockchain)
	 * @returns Instance of `MessageContent` class ancestor
	 */
	static unpackContentFromChunks(chunks: Uint8Array[]) {
		const buf = SmartBuffer.ofSize(chunks.reduce((p, c) => p + c.length, 0));
		for (const chunk of chunks) {
			buf.writeBytes(chunk);
		}
		const rebuf = new SmartBuffer(buf.bytes);
		const version = rebuf.readUint8();
		if (version === 0x04) {
			return this.unpackContentV4(rebuf);
		} else {
			throw new Error(`Version ${version} is not supported`);
		}
	}

	/**
	 * Method to unpack container of version 4.
	 * @param buf Message content bytes
	 * @returns Metadata of the container and message content
	 */
	static unpackContentV4(buf: SmartBuffer) {
		const sessionCode = [buf.readUint8(), buf.readUint8(), buf.readUint8(), buf.readUint8()];
		const isNative = buf.readUint8() === 1;
		const publicKey = buf.readBytes8Length();
		const content = buf.readBytes32Length();
		return {
			version: 0x04,
			isNative,
			sessionCode,
			publicKey,
			content,
		};
	}
}
