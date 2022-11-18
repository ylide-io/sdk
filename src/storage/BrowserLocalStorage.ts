import SmartBuffer from '@ylide/smart-buffer';
import { AbstractStorage } from './AbstractStorage';

/**
 * @category Storage
 * @description Class representing browser local storage
 */
export class BrowserLocalStorage extends AbstractStorage {
	async init() {
		return true;
	}

	async storeBytes(key: string, bytes: Uint8Array): Promise<boolean> {
		try {
			localStorage.setItem(key, new SmartBuffer(bytes).toBase64String());
			return true;
		} catch (err) {
			return false;
		}
	}

	async readBytes(key: string): Promise<Uint8Array | null> {
		try {
			const base64 = localStorage.getItem(key);
			if (base64 === null) {
				return null;
			}
			return SmartBuffer.ofBase64String(base64).bytes;
		} catch {
			return null;
		}
	}

	async clear(): Promise<boolean> {
		try {
			localStorage.clear();
			return true;
		} catch (err) {
			return false;
		}
	}
}
