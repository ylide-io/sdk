import { AbstractStorage } from './AbstractStorage';

/**
 * @category Storage
 * @description Class representing browser iframe storage
 */
export class BrowserIframeStorage extends AbstractStorage {
	private iframe: HTMLIFrameElement | null = null;
	private readonly iframeOrigin: string;
	private iframeReadyPromiseResolve: null | ((result: boolean) => void) = null;

	private readonly reqs: Record<string, (result?: any) => void> = {};

	constructor(private readonly iframeUrl: string = 'https://ks.ylide.io/', private readonly timeout: number = 5000) {
		super();
		this.iframeOrigin = new URL(this.iframeUrl).origin;
	}

	private op<T = any>(type: string, data: any, objectToTransfer?: Transferable | null) {
		return new Promise<T>(resolve => {
			const reqId = String(Math.random() * 100000000) + '.' + String(Math.random() * 100000000);
			this.reqs[reqId] = resolve;
			this.sendMessage(type, { reqId, ...data }, objectToTransfer);
		});
	}

	private sendMessage(type: string, data?: any, objectToTransfer?: Transferable | null) {
		if (!this.iframe || !this.iframe.contentWindow) {
			return;
		}

		this.iframe.contentWindow.postMessage(
			{
				type,
				data,
			},
			this.iframeOrigin,
			objectToTransfer ? [objectToTransfer] : [],
		);
	}

	private handleMessage(msg: { type: string; data: any }) {
		if (msg.type === 'handshake-start') {
			this.sendMessage('handshake-bond');
		} else if (msg.type === 'handshake-success') {
			if (this.iframeReadyPromiseResolve) {
				this.iframeReadyPromiseResolve(true);
			}
		} else if (msg.type === 'handshake-failed') {
			if (this.iframeReadyPromiseResolve) {
				this.iframeReadyPromiseResolve(false);
			}
		} else if (msg.type === 'op-done') {
			const { reqId, result } = msg.data;
			if (this.reqs[reqId]) {
				this.reqs[reqId](result);
			}
		}
	}

	async init() {
		return new Promise<boolean>(resolve => {
			const timeoutTimer = setTimeout(() => {
				return resolve(false);
			}, this.timeout);
			window.addEventListener('message', ev => {
				if (ev.origin === this.iframeOrigin && ev.source === this.iframe?.contentWindow) {
					this.handleMessage(ev.data);
				}
			});
			this.iframe = document.createElement('iframe');
			this.iframe.src = this.iframeUrl;
			this.iframe.style.width = '0px';
			this.iframe.style.height = '0px';
			this.iframe.style.display = 'none';
			this.iframe.style.pointerEvents = 'none';
			this.iframe.style.position = 'absolute';
			this.iframe.style.left = '0px';
			this.iframe.style.top = '0px';
			this.iframe.style.opacity = '0';
			document.body.appendChild(this.iframe);
			this.iframeReadyPromiseResolve = result => {
				clearTimeout(timeoutTimer);
				resolve(result);
			};
		});
	}

	async storeBytes(key: string, bytes: Uint8Array): Promise<boolean> {
		return this.op<boolean>('storeBytes', { key, bytes }, bytes.buffer);
	}

	async readBytes(key: string): Promise<Uint8Array | null> {
		return this.op<Uint8Array | null>('readBytes', { key });
	}

	async clear(): Promise<boolean> {
		return this.op<boolean>('clear', {});
	}
}
