import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ListStorage } from './ListStorage';

interface DBInterface extends DBSchema {
	groupLast: {
		value: { id: string; lastMutableParams: any };
		key: string;
	};
	group: {
		value: { id: string; segments: any[][]; readToBottom: boolean };
		key: string;
	};
}

const DISABLED = false;

export class ListCache<T> {
	private db: IDBPDatabase<DBInterface> | null = null;

	constructor(private readonly group: string) {}

	async loadLastMutableParams() {
		if (!DISABLED) {
			const db = await this.getDB();
			const group = await db.get('groupLast', this.group);
			if (!group) {
				return {};
			} else {
				return group.lastMutableParams;
			}
		}
	}

	async saveLastMutableParams(params: any) {
		if (!DISABLED) {
			const db = await this.getDB();
			await db.put('groupLast', { id: this.group, lastMutableParams: params });
		}
	}

	async save(listStorage: ListStorage<any>) {
		if (!DISABLED) {
			const db = await this.getDB();
			await db.put('group', {
				id: this.group,
				segments: listStorage.segments.map(s => s.toArray()),
				readToBottom: listStorage.readToBottom,
			});
		}
	}

	async load(listStorage: ListStorage<any>) {
		if (!DISABLED) {
			const db = await this.getDB();
			const group = await db.get('group', this.group);
			if (!group) {
				return;
			}
			await listStorage.putObjectsSegments(group.segments, false);
			listStorage.readToBottom = group.readToBottom;
		}
	}

	private async openDB() {
		return await openDB<DBInterface>('ylide-storage-H', 1, {
			upgrade: db => {
				const groupsStore = db.createObjectStore('group', {
					keyPath: 'id',
				});
				const groupLastsStore = db.createObjectStore('groupLast', {
					keyPath: 'id',
				});
			},
		});
	}

	protected async getDB(): Promise<IDBPDatabase<DBInterface>> {
		if (!this.db) {
			this.db = await this.openDB();
		}

		return this.db;
	}
}
