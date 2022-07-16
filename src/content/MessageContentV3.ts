import SmartBuffer, { bufcode } from '@ylide/smart-buffer';
import { MessageContent } from './MessageContent';

export class MessageContentV3 extends MessageContent {
	public static readonly VERSION = 0x03;
	private readonly bytes: Uint8Array;

	private constructor(private readonly isPlain: boolean, subjectBytes: Uint8Array, bytes: Uint8Array) {
		super();
		const buf = SmartBuffer.ofSize(2 + 2 + subjectBytes.length + bytes.length);

		buf.writeUint8(MessageContentV3.VERSION);
		buf.writeUint8(this.isPlain ? 0x01 : 0x02);
		buf.writeBytes16Length(subjectBytes);
		buf.writeBytes(bytes);

		this.bytes = buf.bytes;
	}

	static plain(subject: string, text: string) {
		const subjectBytes = new TextEncoder().encode(subject);
		if (subjectBytes.length > 1024) {
			throw new Error('Subject is too long.');
		}
		const textBytes = new TextEncoder().encode(text);
		return new MessageContentV3(true, subjectBytes, textBytes);
	}

	static rich(subject: string, text: any) {
		const subjectBytes = new TextEncoder().encode(subject);
		if (subjectBytes.length > 1024) {
			throw new Error('Subject is too long.');
		}
		const textBytes = new TextEncoder().encode(JSON.stringify(text));
		return new MessageContentV3(false, subjectBytes, textBytes);
	}

	toBytes() {
		return this.bytes;
	}

	static fromBytes(bytes: Uint8Array) {
		if (bytes.length < 4) {
			throw new Error('Wrong size of buffer');
		}
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version !== this.VERSION) {
			throw new Error('Wrong version');
		}
		const isPlain = buf.readUint8() === 0x01;
		const subjectBytes = buf.readBytes16Length();
		const contentBytes = bytes.slice(4 + subjectBytes.length);
		if (isPlain) {
			return {
				type: 'plain',
				subject: bufcode.utf8.to(subjectBytes),
				content: bufcode.utf8.to(contentBytes),
			};
		} else {
			return {
				type: 'rich',
				subject: bufcode.utf8.to(subjectBytes),
				content: JSON.parse(bufcode.utf8.to(contentBytes)),
			};
		}
	}
}
