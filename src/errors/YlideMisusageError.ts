export class YlideMisusageError extends Error {
	constructor(scope: string, message: string) {
		super(`${scope}: ${message}`);

		// restore prototype chain
		const actualProto = new.target.prototype;

		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, actualProto);
		} else {
			// @ts-ignore
			this.__proto__ = actualProto;
		}
		this.name = 'YlideMisusageError';
	}
}
