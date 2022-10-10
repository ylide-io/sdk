import deepEqual from 'deep-equal';

export class Repository<K, V> {
	private map = new Map<string, V>();

	constructor(private readonly hash: (k: K) => string) {}

	get(k: K): V | null {
		const hash = this.hash(k);
		return this.map.get(hash) || null;
	}

	set(k: K, v: V) {
		const hash = this.hash(k);
		this.map.set(hash, v);
		return v;
	}

	delete(k: K) {
		const hash = this.hash(k);
		return this.map.delete(hash);
	}

	has(k: K) {
		const hash = this.hash(k);
		return this.map.has(hash);
	}
}
