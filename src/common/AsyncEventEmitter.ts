export type EventHandler = (data: any) => Promise<void>;

export class AsyncEventEmitter {
	listeners: Record<string, EventHandler[]> = {};

	async emit(event: string, data?: any, shouldWait = true) {
		if (!this.listeners[event]) {
			return;
		}
		for (const handler of this.listeners[event]) {
			if (shouldWait) {
				await handler(data);
			} else {
				void handler(data);
			}
		}
	}

	on(event: string, handler: EventHandler) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(handler);
	}

	off(event: string, handler: EventHandler) {
		if (!this.listeners[event]) {
			return;
		}
		const idx = this.listeners[event].indexOf(handler);
		if (idx > -1) {
			this.listeners[event].splice(idx, 1);
		}
	}

	has(event: string, handler: EventHandler) {
		if (!this.listeners[event]) {
			return false;
		}
		return this.listeners[event].indexOf(handler) > -1;
	}
}
