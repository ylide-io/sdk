import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ListStorage } from './ListStorage';

interface DBInterface extends DBSchema {
	// messages: {
	// 	value: { id: string; group: string; obj: any };
	// 	key: string;
	// 	indexes: {
	// 		group: string;
	// 	};
	// };
	group: {
		value: { id: string; segments: any[][] };
		key: string;
	};
}

const dev = false;

export class ListCache<T> {
	private db: IDBPDatabase<DBInterface> | null = null;

	constructor(private readonly group: string) {}

	async save(listStorage: ListStorage<any>) {
		if (!dev) {
			const db = await this.getDB();
			await db.put('group', { id: this.group, segments: listStorage.segments.map(s => s.toArray()) });
		}
	}

	async load(listStorage: ListStorage<any>) {
		if (!dev) {
			const db = await this.getDB();
			const group = await db.get('group', this.group);
			if (!group) {
				return;
			}
			await listStorage.putObjectsSegments(group.segments, false);
		}
	}

	private async openDB() {
		return await openDB<DBInterface>('ylide-storage', 1, {
			upgrade(db) {
				// const messagesStore = db.createObjectStore('messages', {
				// 	keyPath: 'id',
				// });
				// // messagesStore.createIndex('time', 'time');
				// messagesStore.createIndex('group', 'group');

				// // ----------------------

				// const segmentsStore = db.createObjectStore('segments', {
				// 	keyPath: 'idx',
				// });
				// segmentsStore.createIndex('group', 'group');

				const groupsStore = db.createObjectStore('group', {
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
