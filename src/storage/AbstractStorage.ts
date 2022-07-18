import SmartBuffer from '@ylide/smart-buffer';

/**
 * @category Storage
 * @description Abstract class representing async key-value storage
 */
export abstract class AbstractStorage {
	/**
	 * Method to store arbitrary bytes array
	 * @param key Key for indexation
	 * @param str Value to store
	 */
	abstract storeBytes(key: string, bytes: Uint8Array): Promise<boolean>;

	/**
	 * Method to store arbitrary string
	 * @param key Key for indexation
	 * @param str Value to store
	 */
	storeString(key: string, str: string): Promise<boolean> {
		return this.storeBytes(key, SmartBuffer.ofUTF8String(str).bytes);
	}

	/**
	 * Method to store arbitrary serializeable object
	 * @param key Key for indexation
	 * @param str Value to store
	 */
	storeJSON(key: string, val: any): Promise<boolean> {
		return this.storeBytes(key, SmartBuffer.ofUTF8String(JSON.stringify(val)).bytes);
	}

	/**
	 * Method to read arbitrary bytes by key
	 * @param key Key to retrieve
	 */
	abstract readBytes(key: string): Promise<Uint8Array | null>;

	/**
	 * Method to clear all key-value storage
	 * @returns Boolean indicating whether operation was successful
	 */
	abstract clear(): Promise<boolean>;

	/**
	 * Method to read string by key
	 * @param key Key to retrieve
	 */
	async readString(key: string): Promise<string | null> {
		const bytes = await this.readBytes(key);
		if (!bytes) {
			return null;
		}
		return new SmartBuffer(bytes).toUTF8String();
	}

	/**
	 * Method to read object by key
	 * @param key Key to retrieve
	 */
	async readJSON<T>(key: string): Promise<T | null> {
		try {
			return JSON.parse((await this.readString(key)) || 'null');
		} catch (err) {
			return null;
		}
	}
}
