import SmartBuffer from '@ylide/smart-buffer';
import { PublicKey } from '../types';

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
	static VERSION = 0x05;

	/**
	 * Method to prepare outgoing message for publishing to blockchain
	 *
	 * @param serviceCode Service code of an app used to send message. Used for analytics, could be left zero-filled.
	 * @param senderPublicKey Public key of message sender
	 * @param contentBytes Content bytes of the message (usually the result of `MessageContent.toBytes()`)
	 * @param chunkSize Max size of one chunk
	 * @returns Wrapped content splet into chunks
	 */
	static packContainer(serviceCode: number, senderPublicKeys: PublicKey[], contentBytes: Uint8Array) {
		const keysSize = senderPublicKeys.reduce((p, c) => p + c.getPackedSize(), 0);
		const buf = SmartBuffer.ofSize(1 + 4 + 1 + keysSize + 4 + contentBytes.length);
		buf.writeUint8(this.VERSION);
		buf.writeUint32(serviceCode);
		buf.writeUint8(senderPublicKeys.length);
		for (const senderPublicKey of senderPublicKeys) {
			senderPublicKey.toPackedBytesInBuffer(buf);
		}
		buf.writeBytes32Length(contentBytes);
		return buf.bytes;
	}

	/**
	 * Method to retrieve message content and metadata from containers' chunks
	 *
	 * @param bytes Raw bytes message container
	 * @returns Instance of `MessageContent` class ancestor
	 */
	static unpackContainter(bytes: Uint8Array) {
		const buf = new SmartBuffer(bytes);
		const version = buf.readUint8();
		if (version === 0x05) {
			return this.unpackContainerV5(buf);
		} else {
			throw new Error(`Version ${version} is not supported`);
		}
	}

	/**
	 * Method to unpack container of version 5.
	 * @param buf Message content bytes
	 * @returns Metadata of the container and message content
	 */
	static unpackContainerV5(buf: SmartBuffer) {
		const serviceCode = buf.readUint32();
		const keysLength = buf.readUint8();
		const senderPublicKeys: PublicKey[] = [];
		for (let i = 0; i < keysLength; i++) {
			senderPublicKeys.push(PublicKey.fromPackedBytesInBuffer(buf));
		}
		const content = buf.readBytes32Length();
		return {
			version: 0x05,
			serviceCode,
			senderPublicKeys,
			content,
		};
	}
}
