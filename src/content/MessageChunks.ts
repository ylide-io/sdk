import SmartBuffer from '@ylide/smart-buffer';

export class MessageChunks {
	/**
	 * Helper method to split long bytes array into smaller ones
	 *
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
	 * Helper method to concat chunks byte arrays into one
	 *
	 * @param chunks Chunks of bytes
	 * @returns Concatenation result
	 */
	static concatMessageChunks(chunks: Uint8Array[]): Uint8Array {
		const buf = SmartBuffer.ofSize(chunks.reduce((p, c) => p + c.length, 0));
		for (const chunk of chunks) {
			buf.writeBytes(chunk);
		}
		return buf.bytes;
	}
}
