import SmartBuffer from '@ylide/smart-buffer';

export abstract class AbstractStorage {
	abstract storeBytes(key: string, bytes: Uint8Array): Promise<boolean>;

	storeString(key: string, str: string): Promise<boolean> {
		return this.storeBytes(key, SmartBuffer.ofUTF8String(str).bytes);
	}

	storeJSON(key: string, val: any): Promise<boolean> {
		return this.storeBytes(key, SmartBuffer.ofUTF8String(JSON.stringify(val)).bytes);
	}

	abstract readBytes(key: string): Promise<Uint8Array | null>;
	abstract clear(): Promise<boolean>;

	async readString(key: string): Promise<string | null> {
		const bytes = await this.readBytes(key);
		if (!bytes) {
			return null;
		}
		return new SmartBuffer(bytes).toUTF8String();
	}

	async readJSON<T>(key: string): Promise<T | null> {
		try {
			return JSON.parse((await this.readString(key)) || 'null');
		} catch (err) {
			return null;
		}
	}
}
