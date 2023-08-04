/**
 * Inputs:
 * - MessageSecureContext
 * - MessageContent with encrypted Attachments
 *
 * Outputs:
 * - packed MessageContent to MessageContrainer to bytes
 */

import { MessageContentV3 } from './MessageContentV3';
import { MessageContentV4 } from './MessageContentV4';
import { MessageContentV5 } from './MessageContentV5';
import { MessagePackedContent } from './MessagePackedContent';

import { YlideError, YlideErrorType } from '../errors';

import type { MessageSecureContext } from './MessageSecureContext';
import type { MessageContent } from './MessageContent';

export class MessageBlob {
	static encodeAndPackAndEncrypt(secureContext: MessageSecureContext, content: MessageContent) {
		const contentRawBytes = this.messageContentToBytes(content);
		const packedContent = MessagePackedContent.pack(contentRawBytes);
		const encodedContent = secureContext.encrypt(packedContent);
		return encodedContent;
	}

	static decryptAndUnpackAndDecode(secureContext: MessageSecureContext, encodedContent: Uint8Array) {
		const packedContent = secureContext.decrypt(encodedContent);
		const contentRawBytes = MessagePackedContent.unpack(packedContent);
		const content = this.messageContentFromBytes(contentRawBytes);
		return content;
	}

	static encodeAndPack(content: MessageContent) {
		const contentRawBytes = this.messageContentToBytes(content);
		const packedContent = MessagePackedContent.pack(contentRawBytes);
		return packedContent;
	}

	static unpackAndDecode(packedContent: Uint8Array) {
		const contentRawBytes = MessagePackedContent.unpack(packedContent);
		const content = this.messageContentFromBytes(contentRawBytes);
		return content;
	}

	/**
	 * Method to get bytes of message content
	 *
	 * @param content `MessageContent` instance to convert into bytes
	 * @returns Raw bytes of message content
	 */
	static messageContentToBytes(content: MessageContent) {
		return content.toBytes();
	}

	/**
	 * Method to get message content instance from raw message content bytes
	 *
	 * @param bytes Raw bytes of message content
	 * @returns Instance of `MessageContent` ancestor
	 */
	static messageContentFromBytes(bytes: Uint8Array) {
		if (bytes.length && bytes[0] === 0x03) {
			return MessageContentV3.fromBytes(bytes);
		} else if (bytes.length && bytes[0] === 0x04) {
			return MessageContentV4.fromBytes(bytes);
		} else if (bytes.length && bytes[0] === 0x05) {
			return MessageContentV5.fromBytes(bytes);
		} else {
			throw new YlideError(YlideErrorType.UNSUPPORTED, 'Unsupported message content version');
		}
	}
}
