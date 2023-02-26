import { MessageAttachmentType } from './MessageAttachmentType';

export abstract class MessageAttachment {
	type: MessageAttachmentType;

	constructor(type: MessageAttachmentType) {
		this.type = type;
	}

	abstract toBytes(): Uint8Array;
}
