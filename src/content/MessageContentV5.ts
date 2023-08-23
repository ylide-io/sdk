import { MessageContent } from './MessageContent';
import { YMF } from './YMF';
import { MessageAttachmentLinkV1 } from './attachments/MessageAttachmentLinkV1';
import { RecipientInfo } from './RecipientInfo';

import { YlideMisusageError } from '../errors/YlideMisusageError';

import { SmartBuffer } from '@ylide/smart-buffer';

import type { Semver } from '../primitives';
import type { MessageAttachment } from './attachments/MessageAttachment';

export interface IMessageContentV5 {
	sendingAgentName: string; // string up to 255 chars
	sendingAgentVersion: Semver;

	subject: string; // simple text, always
	content: YMF; // ylide messaging format

	attachments: MessageAttachment[];

	extraBytes: Uint8Array;
	extraJson: Record<string, any>;

	recipientInfos: RecipientInfo[];
}

/**
 * @category Content
 * @description `MessageContent` ancestor used for the plaintext or simply formatted messages with plaintext subject.
 */
export class MessageContentV5 extends MessageContent implements IMessageContentV5 {
	public static readonly VERSION = 0x05;

	sendingAgentName: string; // string up to 255 chars
	sendingAgentVersion: Semver;

	subject: string; // simple text, always
	content: YMF; // ylide messaging format

	attachments: MessageAttachment[];

	extraBytes: Uint8Array;
	extraJson: Record<string, any>;

	recipientInfos: RecipientInfo[];

	/**
	 * Private constructor for instantiating `MessageContentV5` instance
	 *c
	 *
	 * @param subjectBytes Bytes of the subject text
	 * @param bytes Bytes of the content text
	 */
	constructor(data: IMessageContentV5) {
		super(MessageContentV5.VERSION);

		this.sendingAgentName = data.sendingAgentName;
		this.sendingAgentVersion = data.sendingAgentVersion;

		this.subject = data.subject;
		this.content = data.content;

		this.attachments = data.attachments;

		this.extraBytes = data.extraBytes;
		this.extraJson = data.extraJson;

		this.recipientInfos = data.recipientInfos;
	}

	static simple(subject: string, content?: string) {
		return new MessageContentV5({
			sendingAgentName: 'Ylide SDK Simple',
			sendingAgentVersion: { major: 0, minor: 0, patch: 1 },
			subject: content === undefined ? '' : subject,
			content: YMF.fromPlainText(content === undefined ? subject : content),
			attachments: [],
			extraBytes: new Uint8Array(0),
			extraJson: {},
			recipientInfos: [],
		});
	}

	static isValid(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		return version === MessageContentV5.VERSION;
	}

	toBytes() {
		const subjectBytes = new TextEncoder().encode(this.subject);
		const contentBytes = new TextEncoder().encode(this.content.toString());
		const sendingAgentNameBytes = new TextEncoder().encode(this.sendingAgentName);
		const extraJsonBytes = new TextEncoder().encode(JSON.stringify(this.extraJson));
		const attachmentsBytes = this.attachments.map(a => a.toBytes());
		const recipientInfosBytes = this.recipientInfos.map(r => r.toBytes());

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
				extraJsonBytes.length + // extraJson
				2 + // recipientInfosBytes count
				recipientInfosBytes.reduce((acc, bytes) => acc + 4 + bytes.length, 0), // recipientInfosBytes
		);

		buf.writeUint8(MessageContentV5.VERSION);

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

		buf.writeUint16(recipientInfosBytes.length);
		recipientInfosBytes.forEach(bytes => buf.writeBytes32Length(bytes));

		return buf.bytes;
	}

	/**
	 * Factory method to extract `MessageContentV5` data from raw bytes
	 *
	 * @param bytes Bytes array
	 * @returns Deserialized data
	 */
	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);

		const version = buf.readUint8();

		if (version !== MessageContentV5.VERSION) {
			throw new YlideMisusageError('MessageContentV5', `Unsupported version: ${version}`);
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

		const ymfContent = YMF.fromYMFText(content);

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

		const recipientInfosCount = buf.readUint16();
		const recipientInfos: RecipientInfo[] = [];
		for (let i = 0; i < recipientInfosCount; i++) {
			const recipientInfo = RecipientInfo.fromBytes(buf.readBytes32Length());
			recipientInfos.push(recipientInfo);
		}

		return new MessageContentV5({
			sendingAgentName,
			sendingAgentVersion,
			subject,
			content: ymfContent,
			attachments,
			extraBytes,
			extraJson,
			recipientInfos,
		});
	}
}
