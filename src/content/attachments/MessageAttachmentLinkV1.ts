import SmartBuffer from '@ylide/smart-buffer';
import { MessageAttachment } from './MessageAttachment';
import { MessageAttachmentType } from './MessageAttachmentType';

export interface IMessageAttachmentLinkV1 {
	type: MessageAttachmentType.LINK_V1; // byte
	link: string; // string up to 65535 chars
	previewLink: string; // string up to 65535 chars
	fileName: string; // string up to 255 chars
	isEncrypted: boolean; // byte
}

export class MessageAttachmentLinkV1 extends MessageAttachment implements IMessageAttachmentLinkV1 {
	type: MessageAttachmentType.LINK_V1; // byte
	link: string; // string up to 65535 chars
	previewLink: string; // string up to 65535 chars
	fileName: string; // string up to 255 chars
	isEncrypted: boolean; // byte

	constructor(data: IMessageAttachmentLinkV1) {
		super(data.type);
		this.type = data.type;
		this.link = data.link;
		this.previewLink = data.previewLink;
		this.fileName = data.fileName;
		this.isEncrypted = data.isEncrypted;
	}

	static isValid(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const type = buf.readUint8();
		return type === MessageAttachmentType.LINK_V1;
	}

	toBytes() {
		const linkBytes = new TextEncoder().encode(this.link);
		const previewLinkBytes = new TextEncoder().encode(this.previewLink);
		const fileNameBytes = new TextEncoder().encode(this.fileName);
		const buf = SmartBuffer.ofSize(
			1 + 2 + linkBytes.length + 2 + previewLinkBytes.length + 1 + fileNameBytes.length + 1,
		);
		buf.writeUint8(this.type);
		buf.writeBytes16Length(linkBytes);
		buf.writeBytes16Length(previewLinkBytes);
		buf.writeBytes8Length(fileNameBytes);
		buf.writeUint8(this.isEncrypted ? 1 : 0);
		return buf.bytes;
	}

	static fromBytes(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const type = buf.readUint8();
		if (type !== MessageAttachmentType.LINK_V1) {
			throw new Error('Wrong type');
		}
		const link = new TextDecoder().decode(buf.readBytes16Length());
		const previewLink = new TextDecoder().decode(buf.readBytes16Length());
		const fileName = new TextDecoder().decode(buf.readBytes8Length());
		const isEncrypted = buf.readUint8() === 1;

		return new MessageAttachmentLinkV1({
			type,
			link,
			previewLink,
			fileName,
			isEncrypted,
		});
	}
}
