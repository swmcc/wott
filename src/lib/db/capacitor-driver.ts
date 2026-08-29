import {
	CapacitorSQLite,
	SQLiteConnection,
	type SQLiteDBConnection
} from '@capacitor-community/sqlite';
import type { SqlDriver } from './driver';

const DB_NAME = 'wott';
const DB_VERSION = 1;

/**
 * The only file in the app that imports the native SQLite plugin — everything
 * else talks to `SqlDriver`. Verified on device, not in unit tests.
 */
export async function openCapacitorDriver(): Promise<SqlDriver> {
	const sqlite = new SQLiteConnection(CapacitorSQLite);

	// A connection can survive a webview reload, so reuse it when it's there.
	const existing = await sqlite.isConnection(DB_NAME, false);
	const db: SQLiteDBConnection = existing.result
		? await sqlite.retrieveConnection(DB_NAME, false)
		: await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

	const open = await db.isDBOpen();
	if (!open.result) {
		await db.open();
	}

	return {
		async run(sql, params = []) {
			// transaction: false — transactions are ours to open (see withTransaction).
			if (params.length > 0) {
				await db.run(sql, params, false);
			} else {
				await db.execute(sql, false);
			}
		},
		async query(sql, params = []) {
			const result = await db.query(sql, params);
			return (result.values ?? []) as never[];
		}
	};
}
