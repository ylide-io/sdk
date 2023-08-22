import { CriticalSection } from '../common';
import { BlockchainSourceType } from '../messages-list';
import { YlideError, YlideErrorType } from '../errors';

import { SmartBuffer } from '@ylide/smart-buffer';

import type { IMessage, IMessageContent, IMessageCorruptedContent, Uint256 } from '../primitives';
import type { IndexerMessagesSource } from './IndexerMessagesSource';

const IS_DEV = false;

const endpoints = IS_DEV
	? ['http://localhost:9999']
	: [
			'https://idx1.ylide.io',
			'https://idx2.ylide.io',
			'https://idx3.ylide.io',
			'https://idx4.ylide.io',
			'https://idx5.ylide.io',
	  ];

export class IndexerHub {
	private endpoint = '';
	private lastTryTimestamps: Record<string, number> = {};

	private cs: CriticalSection = new CriticalSection();
	public readonly useWebSocketPulling;
	private webSocket: WebSocket | null = null;
	private subscriptions: Set<IndexerMessagesSource> = new Set();

	constructor(useWebSocketPulling?: boolean) {
		if (typeof useWebSocketPulling === 'undefined') {
			this.useWebSocketPulling = typeof window !== 'undefined' && window?.WebSocket ? true : false;
		} else {
			this.useWebSocketPulling = useWebSocketPulling;
		}
		this.init();
	}

	subscribe(instance: IndexerMessagesSource) {
		if (this.subscriptions.has(instance)) {
			return;
		}
		this.subscriptions.add(instance);
		this.webSocket?.send(
			JSON.stringify({
				cmd: 'join',
				id: instance.channel,
				blockchain: instance.subject.blockchain,
				sender: instance.subject.sender,
				recipient: instance.subject.type === BlockchainSourceType.DIRECT ? instance.subject.recipient : null,
				feedId: instance.subject.feedId,
				mailerId: instance.subject.id,
				type: instance.subject.type,
			}),
		);
	}

	unsubscribe(instance: IndexerMessagesSource) {
		if (!this.subscriptions.has(instance)) {
			return;
		}
		this.subscriptions.delete(instance);
		this.webSocket?.send(
			JSON.stringify({
				cmd: 'leave',
				id: instance.channel,
			}),
		);
	}

	private initWebSocket() {
		const ws = new WebSocket('wss://push1.ylide.io/v2/client');
		ws.onopen = () => {
			this.webSocket = ws;
			for (const instance of this.subscriptions) {
				ws.send(
					JSON.stringify({
						cmd: 'join',
						id: instance.channel,
						blockchain: instance.subject.blockchain,
						sender: instance.subject.sender,
						recipient:
							instance.subject.type === BlockchainSourceType.DIRECT ? instance.subject.recipient : null,
						feedId: instance.subject.feedId,
						mailerId: instance.subject.id,
						type: instance.subject.type,
					}),
				);
			}
		};
		ws.onerror = err => {
			console.log(`Ylide Indexer WebSocket error: `, err);
		};
		ws.onmessage = event => {
			let data: {
				type: 'ylide-direct-message';
				channels: string[];
				msg: any;
			};
			try {
				data = JSON.parse(event.data);
			} catch (err) {
				return;
			}
			if (data.type === 'ylide-direct-message') {
				for (const instance of this.subscriptions) {
					if (data.channels.includes(instance.channel)) {
						instance.commitNewMessages([
							{
								...data.msg,
								key: new Uint8Array(data.msg.key),
							},
						]);
					}
				}
			}
		};
		ws.onclose = () => {
			this.webSocket = null;
			console.log(`Ylide Indexer WebSocket closed. Reconnecting in 1s...`);
			setTimeout(() => {
				this.initWebSocket();
			}, 1000);
		};
	}

	private init() {
		if (this.useWebSocketPulling) {
			this.initWebSocket();
		}
	}

	async retryingOperation<T>(callback: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
		let lastErr;
		if (this.endpoint) {
			try {
				return await callback();
			} catch (err) {
				this.lastTryTimestamps[this.endpoint] = Date.now();
				// tslint:disable-next-line
				console.error(`Endpoint ${this.endpoint} is unavailable due to the error: `, err);
				this.endpoint = '';
			}
		}
		await this.cs.enter();
		if (this.endpoint) {
			this.cs.leave();
			return await this.retryingOperation(callback, fallback);
		}
		try {
			const _endpoints = endpoints.slice();
			while (_endpoints.length) {
				const tempEndpoint = _endpoints.splice(Math.floor(Math.random() * _endpoints.length), 1)[0];
				if (Date.now() - this.lastTryTimestamps[tempEndpoint] < 20000) {
					continue;
				}
				try {
					const startTime = Date.now();
					const response = await fetch(`${tempEndpoint}/ping`);
					const text = await response.text();
					const endTime = Date.now();
					if (response.status === 200 && text === 'PONG' && endTime - startTime < 5000) {
						this.endpoint = tempEndpoint;
						try {
							return await callback();
						} catch (err) {
							// tslint:disable-next-line
							console.error(`Endpoint ${this.endpoint} is unavailable due to the error: `, err);
							this.lastTryTimestamps[this.endpoint] = Date.now();
							this.endpoint = '';
						}
					}
				} catch (err) {
					this.lastTryTimestamps[tempEndpoint] = Date.now();
					// tslint:disable-next-line
					console.error(`Endpoint ${tempEndpoint} is unavailable due to the error: `, err);
				}
			}
		} finally {
			this.cs.leave();
		}
		// tslint:disable-next-line
		// console.error(`All indexer endpoints were unavailable. Switched back to the direct blockchain reading: `, lastErr);
		return fallback();
	}

	async request(url: string, body: any) {
		let responseBody;
		try {
			const response = await fetch(`${this.endpoint}${url}`, {
				method: 'POST',
				body: JSON.stringify(body),
				headers: {
					'Content-Type': 'text/plain',
				},
			});
			responseBody = await response.json();
		} catch (err: any) {
			throw new YlideError(YlideErrorType.NETWORK_ERROR, err?.message, err);
		}
		if (responseBody.result) {
			return responseBody.data;
		} else {
			throw new YlideError(YlideErrorType.RESPONSE_ERROR, responseBody.error || 'Response error');
		}
	}

	async requestMultipleKeys(addresses: string[]): Promise<
		Record<
			string,
			Record<
				string,
				{
					block: number;
					keyVersion: number;
					publicKey: Uint8Array;
					timestamp: number;
					registrar: number;
				} | null
			>
		>
	> {
		const data = await this.request('/multi-keys', { addresses });
		return Object.keys(data).reduce(
			(p, addr) => ({
				...p,
				[addr]: Object.keys(data[addr]).reduce(
					(p2, bc) => ({
						...p2,
						[bc]: data[addr][bc]
							? {
									...data[addr][bc],
									publicKey: SmartBuffer.ofHexString(data[addr][bc].publicKey).bytes,
							  }
							: null,
					}),
					{} as Record<
						string,
						{
							block: number;
							keyVersion: number;
							publicKey: Uint8Array;
							timestamp: number;
							registrar: number;
						} | null
					>,
				),
			}),
			{} as Record<
				string,
				Record<
					string,
					{
						block: number;
						keyVersion: number;
						publicKey: Uint8Array;
						timestamp: number;
						registrar: number;
					} | null
				>
			>,
		);
	}

	async requestKeysHistory(addresses: string[]): Promise<
		Record<
			string,
			{
				blockchain: string;
				block: number;
				keyVersion: number;
				publicKey: Uint8Array;
				timestamp: number;
				registrar: number;
			}[]
		>
	> {
		const data = await this.request('/keys-history', { addresses });
		return data;
	}

	async requestKeys(address: string) {
		const data = await this.request('/keys', { address });
		return Object.keys(data).reduce(
			(p, bc) => ({
				...p,
				...(data[bc]
					? {
							[bc]: {
								...data[bc],
								publicKey: SmartBuffer.ofHexString(data[bc].publicKey).bytes,
								registrar: 0,
							},
					  }
					: {}),
			}),
			{},
		) as Record<
			string,
			{
				block: number;
				keyVersion: number;
				publicKey: Uint8Array;
				timestamp: number;
				registrar: number;
			}
		>;
	}

	async loadMessagesCount(recipients: Uint256[], timestamp = 0): Promise<Record<Uint256, Record<string, number>>> {
		return this.request('/messages-count', {
			recipients,
			timestamp,
		});
	}

	async requestMultiMessages(
		requests: {
			blockchain: string;
			fromMessageId: null | string;
			toMessageId: null | string;
			sender: string | null;
			recipient: Uint256 | null;
			feedId: Uint256 | null;
			mailerId: string;
			type: 'DIRECT' | 'BROADCAST';
			limit: number;
		}[],
	): Promise<({ result: true; data: IMessage[] } | { result: false; error: string })[]> {
		const enrichedRequests = requests.map(r => ({
			body: r,
			id: String(Math.floor(Math.random() * 1000000000000)),
		}));
		const response = await this.request('/multi-messages', { requests: enrichedRequests });
		return enrichedRequests.map(r => {
			const result = response.find((g: any) => g.id === r.id);
			return result?.response;
		});
	}

	messagesDebouncer: {
		resolve: (value: IMessage[]) => void;
		reject: (reason?: any) => void;
		request: {
			blockchain: string;
			fromMessageId: null | string;
			toMessageId: null | string;
			sender: string | null;
			recipient: Uint256 | null;
			feedId: Uint256 | null;
			mailerId: string;
			type: 'DIRECT' | 'BROADCAST';
			limit: number;
		};
	}[] = [];
	messagesDebounceTimer: any = null;

	async requestMessages(request: {
		blockchain: string;
		fromMessageId: null | string;
		toMessageId: null | string;
		sender: string | null;
		recipient: Uint256 | null;
		feedId: Uint256 | null;
		mailerId: string;
		type: 'DIRECT' | 'BROADCAST';
		limit: number;
	}): Promise<IMessage[]> {
		const data = await new Promise<IMessage[]>((resolve, reject) => {
			this.messagesDebouncer.push({
				resolve,
				reject,
				request,
			});
			if (!this.messagesDebounceTimer) {
				this.messagesDebounceTimer = setTimeout(() => {
					this.messagesDebounceTimer = null;
					const requests = [...this.messagesDebouncer];
					this.messagesDebouncer = [];
					(async () => {
						const responses = await this.requestMultiMessages(requests.map(r => r.request));
						responses.forEach((response, i) => {
							if (response?.result === true) {
								requests[i].resolve(response.data);
							} else {
								requests[i].reject(response?.error || 'Response error');
							}
						});
					})().catch(reject);
				}, 100);
			}
		});
		// const data = await this.request(`/${blockchain}`, {
		// 	fromBlock,
		// 	toBlock,
		// 	fromMessage,
		// 	toMessage,
		// 	sender,
		// 	recipient,
		// 	feedId,
		// 	mailerId,
		// 	type,
		// 	limit,
		// });
		return data.map((m: any) => ({
			...m,
			key: new Uint8Array(m.key),
		}));
	}

	async requestContent({
		blockchain,
		msgId,
	}: {
		blockchain: string;
		msgId: string;
	}): Promise<IMessageCorruptedContent | IMessageContent | null> {
		const data = await this.request(`/content/${blockchain}`, {
			msgId,
		});
		if (!data || data.corrupted) {
			return data;
		} else {
			return {
				...data,
				content: SmartBuffer.ofBase64String(data.content).bytes,
			};
		}
	}
}
