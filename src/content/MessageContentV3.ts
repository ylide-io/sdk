import { MessageContent } from './MessageContent';

import { YlideMisusageError } from '../errors/YlideMisusageError';

import { SmartBuffer } from '@ylide/smart-buffer';

export interface IMessageContentV3 {
	isPlain: boolean;
	subject: string;
	content: string;
}

/**
 * @category Content
 * @description `MessageContent` ancestor used for the plaintext or simply formatted messages with plaintext subject.
 */
export class MessageContentV3 extends MessageContent implements IMessageContentV3 {
	public static readonly VERSION = 0x03;

	isPlain: boolean;
	subject: string;
	content: string;

	/**
	 * Private constructor for instantiating `MessageContentV3` instance
	 *
	 * @param isPlain Is message plaintext of formatted
	 * @param subjectBytes Bytes of the subject text
	 * @param bytes Bytes of the content text
	 */
	constructor(data: IMessageContentV3) {
		super(MessageContentV3.VERSION);

		this.isPlain = data.isPlain;
		this.subject = data.subject;
		this.content = data.content;
	}

	static isValid(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		return version === MessageContentV3.VERSION;
	}

	/**
	 * Factory method for creating plaintext message content
	 *
	 * @param subject Message subject in plaintext
	 * @param text Message content in plaintext
	 * @returns `MessageContentV3` instance
	 */
	static plain(subject: string, text: string) {
		return new MessageContentV3({ isPlain: true, subject, content: text });
	}

	/**
	 * Factory method for creating formatted message content
	 *
	 * @param subject Message subject in plaintext
	 * @param text Message content in serializeable object
	 * @returns `MessageContentV3` instance
	 */
	static rich(subject: string, text: any) {
		return new MessageContentV3({ isPlain: false, subject, content: JSON.stringify(text) });
	}

	toBytes() {
		const subjectBytes = new TextEncoder().encode(this.subject);
		if (subjectBytes.length > 1024) {
			throw new YlideMisusageError('MessageContentV3', 'Subject is too long.');
		}
		const contentBytes = new TextEncoder().encode(this.content);

		const buf = SmartBuffer.ofSize(1 + 1 + 2 + subjectBytes.length + contentBytes.length);

		buf.writeUint8(MessageContentV3.VERSION);
		buf.writeUint8(this.isPlain ? 0x01 : 0x02);
		buf.writeBytes16Length(subjectBytes);
		buf.writeBytes(contentBytes);

		return buf.bytes;
	}

	/**
	 * Factory method to extract `MessageContentV3` data from raw bytes
	 *
	 * @param bytes Bytes array
	 * @returns Deserialized data
	 */
	static fromBytes(bytes: Uint8Array) {
		if (bytes.length < 4) {
			throw new YlideMisusageError('MessageContentV3', 'Wrong size of buffer');
		}
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version !== this.VERSION) {
			throw new YlideMisusageError('MessageContentV3', 'Wrong version');
		}
		const isPlain = buf.readUint8() === 0x01;
		const subjectBytes = buf.readBytes16Length();
		const contentBytes = bytes.slice(4 + subjectBytes.length);

		return new MessageContentV3({
			isPlain,
			subject: new TextDecoder().decode(subjectBytes),
			content: new TextDecoder().decode(contentBytes),
		});
	}
}
