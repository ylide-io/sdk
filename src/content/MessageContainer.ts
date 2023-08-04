import { EncryptionPublicKey } from '../primitives/EncryptionPublicKey';
import { YlideError, YlideErrorType } from '../errors';

import { SmartBuffer } from '@ylide/smart-buffer';

import type { ServiceCode } from '../primitives';

export interface IUnpackedMessageContainer {
	version: number;
	serviceCode: ServiceCode;
	senderPublicKeys: EncryptionPublicKey[];
	messageBlob: Uint8Array;
	isEncoded: boolean;
}

/**
 * @category Content
 * @description Internal helper class to pack content into container and split it into chunks (for blockchains with transaction size limit)
 * @example
 * ```ts
 * // Packing:
 *
 * const recipientAddresses: string[] = [...];
 *
 * const messageContent = MessageContentV3.plain('Hi there', 'Hello world everyone :)');
 * const { encodedContent, key } = MessageEncodedContent.encodeContent(messageContent);
 * const preparedRecipients = await sender.prepareRecipients(recipientAddresses);
 * const container = MessageContainer.packContainer(ServiceCode.SDK, senderPublicKey, encodedContent)
 * const chunks = MessageChunks.packContainer();
 * // Broadcast chunks through blockchain
 *
 * // Unpacking:
 * const chunks: Uint8Array[] = await readChunksFromSomewhere();
 * const content = MessageChunks.unpackContainer(chunks);
 * console.log('Your message: ', content);
 * ```
 */
export class MessageContainer {
	static VERSION = 0x06;

	/**
	 * Method to prepare outgoing message for publishing to blockchain
	 *
	 * @param serviceCode Service code of an app used to send message. Used for analytics, could be left zero-filled.
	 * @param senderPublicKey Public key of message sender
	 * @param messageBlobBytes Raw bytes of the message blob (usually the result of `MessageBlob.encode`)
	 * @param chunkSize Max size of one chunk
	 * @returns Wrapped content splet into chunks
	 */
	static packContainer(
		serviceCode: number,
		isEncoded: boolean,
		senderPublicKeys: EncryptionPublicKey[],
		messageBlobBytes: Uint8Array,
	) {
		const keysSize = senderPublicKeys.reduce((p, c) => p + c.getPackedSize(), 0);
		const buf = SmartBuffer.ofSize(1 + 4 + 1 + 1 + keysSize + 4 + messageBlobBytes.length);
		buf.writeUint8(this.VERSION);
		buf.writeUint32(serviceCode);
		buf.writeUint8(isEncoded ? 1 : 0);
		buf.writeUint8(senderPublicKeys.length);
		for (const senderPublicKey of senderPublicKeys) {
			senderPublicKey.toPackedBytesInBuffer(buf);
		}
		buf.writeBytes32Length(messageBlobBytes);
		return buf.bytes;
	}

	/**
	 * Method to retrieve message content and metadata from containers' chunks
	 *
	 * @param bytes Raw bytes message container
	 * @returns Instance of `MessageContent` class ancestor
	 */
	static unpackContainter(bytes: Uint8Array): IUnpackedMessageContainer {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version === 0x06) {
			return this.unpackContainerV6(buf);
		} else if (version === 0x05) {
			return this.unpackContainerV5(buf);
		} else {
			throw new YlideError(YlideErrorType.UNSUPPORTED, `Version ${version} is not supported`);
		}
	}

	/**
	 * Method to unpack container of version 5.
	 *
	 * @param buf Message content bytes
	 * @returns Metadata of the container and message content
	 */
	static unpackContainerV5(buf: SmartBuffer): IUnpackedMessageContainer {
		const serviceCode = buf.readUint32();
		const keysLength = buf.readUint8();
		const senderPublicKeys: EncryptionPublicKey[] = [];
		for (let i = 0; i < keysLength; i++) {
			senderPublicKeys.push(EncryptionPublicKey.fromPackedBytesInBuffer(buf));
		}
		const messageBlob = buf.readBytes32Length();
		return {
			version: 0x05,
			serviceCode,
			senderPublicKeys,
			messageBlob,
			isEncoded: true,
		};
	}

	/**
	 * Method to unpack container of version 6.
	 *
	 * @param buf Message content bytes
	 * @returns Metadata of the container and message content
	 */
	static unpackContainerV6(buf: SmartBuffer): IUnpackedMessageContainer {
		const serviceCode = buf.readUint32();
		const isEncoded = buf.readUint8() === 1;
		const keysLength = buf.readUint8();
		const senderPublicKeys: EncryptionPublicKey[] = [];
		for (let i = 0; i < keysLength; i++) {
			senderPublicKeys.push(EncryptionPublicKey.fromPackedBytesInBuffer(buf));
		}
		const messageBlob = buf.readBytes32Length();
		return {
			version: 0x06,
			serviceCode,
			senderPublicKeys,
			messageBlob,
			isEncoded,
		};
	}
}
