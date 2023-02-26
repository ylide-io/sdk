/**
 * @category Content
 * @description An abstract class used to define content of the message which can be converted to bytes
 */
export abstract class MessageContent {
	version: number;

	constructor(version: number) {
		this.version = version;
	}
	/**
	 * Method used to get bytes representation of the message content
	 */
	abstract toBytes(): Uint8Array;
}
