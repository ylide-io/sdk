export abstract class AbstractNameService {
	abstract isCandidate(name: string): boolean;
	abstract resolve(name: string): Promise<string | null>;
	abstract reverseResolve(address: string): Promise<string | null>;
}
