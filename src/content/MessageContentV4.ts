import SmartBuffer from '@ylide/smart-buffer';
import { Semver } from '../types';
import { MessageContent } from './MessageContent';
import { MessageFormat, YMF } from './MessageFormat';
import { MessageAttachment } from './attachments/MessageAttachment';
import { MessageAttachmentLinkV1 } from './attachments/MessageAttachmentLinkV1';

export interface IMessageContentV4 {
	sendingAgentName: string; // string up to 255 chars
	sendingAgentVersion: Semver;

	subject: string; // simple text, always
	content: YMF; // ylide messaging format

	attachments: MessageAttachment[];

	extraBytes: Uint8Array;
	extraJson: Record<string, any>;
}

/**
 * @category Content
 * @description `MessageContent` ancestor used for the plaintext or simply formatted messages with plaintext subject.
 */
export class MessageContentV4 extends MessageContent implements IMessageContentV4 {
	public static readonly VERSION = 0x04;

	sendingAgentName: string; // string up to 255 chars
	sendingAgentVersion: Semver;

	subject: string; // simple text, always
	content: YMF; // ylide messaging format

	attachments: MessageAttachment[];

	extraBytes: Uint8Array;
	extraJson: Record<string, any>;

	/**
	 * Private constructor for instantiating `MessageContentV4` instance
	 *c
	 *
	 * @param subjectBytes Bytes of the subject text
	 * @param bytes Bytes of the content text
	 */
	constructor(data: IMessageContentV4) {
		super(MessageContentV4.VERSION);

		this.sendingAgentName = data.sendingAgentName;
		this.sendingAgentVersion = data.sendingAgentVersion;

		this.subject = data.subject;
		this.content = data.content;

		this.attachments = data.attachments;

		this.extraBytes = data.extraBytes;
		this.extraJson = data.extraJson;
	}

	static isValid(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		return version === MessageContentV4.VERSION;
	}

	toBytes() {
		const subjectBytes = new TextEncoder().encode(this.subject);
		const contentBytes = new TextEncoder().encode(this.content);
		const sendingAgentNameBytes = new TextEncoder().encode(this.sendingAgentName);
		const extraJsonBytes = new TextEncoder().encode(JSON.stringify(this.extraJson));
		const attachmentsBytes = this.attachments.map(a => a.toBytes());

		const buf = SmartBuffer.ofSize(
			1 + // version
				1 + // sendingAgentName length
				sendingAgentNameBytes.length + // sendingAgentName
				4 + // sendingAgentVersion
				2 + // subject length
				subjectBytes.length + // subject
				4 + // content length
				contentBytes.length + // content
				2 + // attachments count
				attachmentsBytes.reduce((acc, bytes) => acc + 4 + bytes.length, 0) + // attachments
				4 + // extraBytes length
				this.extraBytes.length + // extraBytes
				4 + // extraJson length
				extraJsonBytes.length, // extraJson
		);

		buf.writeUint8(MessageContentV4.VERSION);

		buf.writeBytes8Length(sendingAgentNameBytes);

		buf.writeUint16(this.sendingAgentVersion.major);
		buf.writeUint8(this.sendingAgentVersion.minor);
		buf.writeUint8(this.sendingAgentVersion.patch);

		buf.writeBytes16Length(subjectBytes);
		buf.writeBytes32Length(contentBytes);

		buf.writeUint16(attachmentsBytes.length);
		attachmentsBytes.forEach(bytes => buf.writeBytes32Length(bytes));

		buf.writeBytes32Length(this.extraBytes);
		buf.writeBytes32Length(extraJsonBytes);

		return buf.bytes;
	}

	/**
	 * Factory method to extract `MessageContentV4` data from raw bytes
	 *
	 * @param bytes Bytes array
	 * @returns Deserialized data
	 */
	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);

		const version = buf.readUint8();

		if (version !== MessageContentV4.VERSION) {
			throw new Error(`Unsupported version: ${version}`);
		}

		const sendingAgentNameBytes = buf.readBytes8Length();
		const sendingAgentName = new TextDecoder().decode(sendingAgentNameBytes);

		const major = buf.readUint16();
		const minor = buf.readUint8();
		const patch = buf.readUint8();
		const sendingAgentVersion: Semver = { major, minor, patch };

		const subjectBytes = buf.readBytes16Length();
		const subject = new TextDecoder().decode(subjectBytes);

		const contentBytes = buf.readBytes32Length();
		const content = new TextDecoder().decode(contentBytes);

		const validationResult = MessageFormat.validateYMF(content);
		if (!validationResult.result) {
			throw new Error(
				'Invalid content YMF: ' + validationResult.errorText + ` at pos ${validationResult.errorPos}`,
			);
		}

		const attachmentsCount = buf.readUint16();
		const attachments: MessageAttachment[] = [];
		for (let i = 0; i < attachmentsCount; i++) {
			const attachmentBytes = buf.readBytes32Length();
			if (MessageAttachmentLinkV1.isValid(attachmentBytes)) {
				const attachment = MessageAttachmentLinkV1.fromBytes(attachmentBytes);
				attachments.push(attachment);
				continue;
			} else {
				// unsupported attachment type, skipping
			}
		}

		const extraBytes = buf.readBytes32Length();

		const extraJsonBytes = buf.readBytes32Length();
		const extraJson = JSON.parse(new TextDecoder().decode(extraJsonBytes));

		return new MessageContentV4({
			sendingAgentName,
			sendingAgentVersion,
			subject,
			content: content as YMF,
			attachments,
			extraBytes,
			extraJson,
		});
	}
}
