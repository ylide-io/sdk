export abstract class AbstractNameService {
	/**
	 * Method to check whether this name could be theoretically resolved by this name service
	 *
	 * @param name - Name to check (e.g. "sewald.eth")
	 */
	abstract isCandidate(name: string): boolean;

	/**
	 * Method to resolve name to address
	 *
	 * @param name - Name to resolve (e.g. "elkornacio.eth")
	 */
	abstract resolve(name: string): Promise<string | null>;

	/**
	 * Method to reverse resolve address to name
	 *
	 * @param address - Address to reverse resolve (e.g. "0x1234...")
	 */
	abstract reverseResolve(address: string): Promise<string | null>;
}
