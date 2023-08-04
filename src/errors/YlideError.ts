export enum YlideErrorType {
	NOT_FOUND = 'NOT_FOUND',
	UNAVAILABLE = 'UNAVAILABLE',
	UNSUPPORTED = 'UNSUPPORTED',
	INVALID_PARAM = 'INVALID_PARAM',
	DECRYPTION_KEY_UNAVAILABLE = 'DECRYPTION_KEY_UNAVAILABLE',
	MUST_NEVER_HAPPEN = 'MUST_NEVER_HAPPEN',
	NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

	NETWORK_ERROR = 'NETWORK_ERROR',
	RESPONSE_ERROR = 'RESPONSE_ERROR',

	WAS_CANCELLED = 'WAS_CANCELLED',
	ACCOUNT_UNREACHABLE = 'ACCOUNT_UNREACHABLE',
}

export class YlideError extends Error {
	constructor(code: YlideErrorType, message: string, public readonly extras?: any) {
		super(`${code}: ${message}`);

		// restore prototype chain
		const actualProto = new.target.prototype;

		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, actualProto);
		} else {
			// @ts-ignore
			this.__proto__ = actualProto;
		}
		this.name = 'YlideError';
	}

	static is(err: unknown, code: YlideErrorType) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
		return err && typeof err === 'object' && err instanceof YlideError && err.message === code;
	}
}
