import SmartBuffer from '@ylide/smart-buffer';
import { AbstractStorage } from './AbstractStorage';

export class BrowserLocalStorage extends AbstractStorage {
	async storeBytes(key: string, bytes: Uint8Array): Promise<boolean> {
		localStorage.setItem(key, new SmartBuffer(bytes).toBase64String());
		return true;
	}

	async readBytes(key: string): Promise<Uint8Array | null> {
		const base64 = localStorage.getItem(key);
		if (base64 === null) {
			return null;
		}
		return SmartBuffer.ofBase64String(base64).bytes;
	}

	async clear(): Promise<boolean> {
		localStorage.clear();
		return true;
	}
}
