export enum YlideErrorType {
	USER_CANCELLED = 'user_cancelled',
	ACCOUNT_UNREACHABLE = 'account_unreachable',
	NOT_SUPPORTED = 'not_supported',
}

export class YlideError extends Error {
	constructor(code: YlideErrorType, public readonly extras?: any) {
		super(code);
	}

	static is(err: unknown, code: YlideErrorType) {
		return err && typeof err === 'object' && err instanceof YlideError && err.message === code;
	}
}
