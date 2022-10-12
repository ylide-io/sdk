export interface IExecutionFuture<ExecutionResult = any> {
	type: 'success' | 'error' | 'cancelled';
	result: ExecutionResult | null;
	error: any | null;
}

export interface ExecutionState<ExecutionRequest = any> {
	request: ExecutionRequest;
	cancelled: boolean;
}

export interface ExecutionWrap<ExecutionRequest = any, ExecutionResult = any> extends ExecutionState<ExecutionRequest> {
	future: IExecutionFuture<ExecutionResult> | null;
	executionPromise: Promise<any> | null;
	promiseResolve: (result: IExecutionFuture<ExecutionResult>) => void;
	promiseReject: (err: any) => void;
}

export interface ExecutionObserver<ExecutionRequest = any, ExecutionResult = any> {
	request: ExecutionRequest;
	promise: Promise<IExecutionFuture<ExecutionResult>>;
	cancel: () => void;
}

export type Executor<ExecutionRequest = any, ExecutionResult = any> = (
	state: ExecutionState<ExecutionRequest>,
) => Promise<IExecutionFuture<ExecutionResult>>;

export class ExecutionQueue<ExecutionRequest = any, ExecutionResult = any> {
	readonly queue: ExecutionWrap<ExecutionRequest, ExecutionResult>[] = [];
	readonly executor: Executor<ExecutionRequest, ExecutionResult>;
	private _isExecuting: boolean = false;
	private currentExecuting: null | ExecutionWrap<ExecutionRequest, ExecutionResult> = null;

	constructor(executor: Executor<ExecutionRequest, ExecutionResult>) {
		this.executor = executor;
	}

	get isExecuting() {
		return this._isExecuting;
	}

	async cancelAll() {
		const copy = this.queue.slice();
		this.queue.splice(0, this.queue.length);
		for (const current of copy) {
			current.future = {
				result: null,
				error: null,
				type: 'cancelled',
			};
			current.cancelled = true;
			current.promiseResolve(current.future);
		}
		if (this.currentExecuting) {
			this.currentExecuting.cancelled = true;
			if (this.currentExecuting.executionPromise) {
				try {
					await this.currentExecuting.executionPromise;
				} catch (err) {
					// np
				}
			}
		}
	}

	execute(request: ExecutionRequest): ExecutionObserver<ExecutionRequest, ExecutionResult> {
		const wrap: ExecutionWrap<ExecutionRequest, ExecutionResult> = {
			request,
			future: null,
			executionPromise: null,
			cancelled: false,
			// tslint:disable-next-line
			promiseResolve: () => {},
			// tslint:disable-next-line
			promiseReject: () => {},
		};
		const promise = new Promise<IExecutionFuture<ExecutionResult>>((resolve, reject) => {
			wrap.promiseResolve = resolve;
			wrap.promiseReject = reject;
		});
		this.queue.push(wrap);
		this.tickQueue();
		return {
			request,
			promise,
			cancel: () => (wrap.cancelled = true),
		};
	}

	private async tickQueue() {
		if (this._isExecuting) {
			return;
		}
		if (!this.queue.length) {
			return;
		}
		this._isExecuting = true;
		const current = this.queue.shift()!;
		this.currentExecuting = current;
		if (current.cancelled) {
			current.future = {
				result: null,
				error: null,
				type: 'cancelled',
			};
			current.promiseResolve(current.future);
			this._isExecuting = false;
			this.currentExecuting = null;
		} else {
			try {
				const executionPromise = this.executor(current);
				current.executionPromise = executionPromise;
				const result = await executionPromise;
				current.future = result;
				current.promiseResolve(result);
				this._isExecuting = false;
				this.currentExecuting = null;
			} catch (error) {
				current.future = {
					result: null,
					error,
					type: 'error',
				};
				current.promiseResolve(current.future);
				this._isExecuting = false;
				this.currentExecuting = null;
			}
		}
		this.tickQueue();
	}
}
