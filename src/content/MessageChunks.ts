import SmartBuffer from '@ylide/smart-buffer';

export class MessageChunks {
	static VERSION = 0x04;

	static splitMessageChunks(bytes: Uint8Array, chunkSize = 15 * 1024): Uint8Array[] {
		const chunks: Uint8Array[] = [];
		for (let offset = 0; offset < bytes.length; offset += chunkSize) {
			const chunk = bytes.slice(offset, offset + chunkSize);
			chunks.push(chunk);
		}
		return chunks;
	}

	static packContentInChunks(
		serviceCode: [number, number, number, number],
		publicKey: Uint8Array,
		content: Uint8Array,
		chunkSize = 15 * 1024,
	) {
		const buf = SmartBuffer.ofSize(1 + 4 + 1 + publicKey.length + 4 + content.length);
		buf.writeUint8(this.VERSION);
		buf.writeUint8(serviceCode[0]);
		buf.writeUint8(serviceCode[1]);
		buf.writeUint8(serviceCode[2]);
		buf.writeUint8(serviceCode[3]);
		buf.writeBytes8Length(publicKey);
		buf.writeBytes32Length(content);
		return this.splitMessageChunks(buf.bytes, chunkSize);
	}

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

	static unpackContentV4(buf: SmartBuffer) {
		const sessionCode = [buf.readUint8(), buf.readUint8(), buf.readUint8(), buf.readUint8()];
		const publicKey = buf.readBytes8Length();
		const content = buf.readBytes32Length();
		return {
			version: 0x04,
			sessionCode,
			publicKey,
			content,
		};
	}
}
