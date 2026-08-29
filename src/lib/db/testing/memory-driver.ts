import Database from 'better-sqlite3';
import type { SqlDriver } from '../driver';

/**
 * Test-only driver: real SQLite (better-sqlite3) in memory, so migrations and
 * the DAL run against actual SQL rather than mocks. App code must never import
 * anything under `db/testing/` — better-sqlite3 is a devDependency.
 */
export function createMemoryDriver(): SqlDriver {
	const db = new Database(':memory:');

	return {
		async run(sql, params = []) {
			if (params.length > 0) {
				db.prepare(sql).run(params as unknown[]);
			} else {
				// exec() also copes with the multi-statement and PRAGMA forms.
				db.exec(sql);
			}
		},
		async query(sql, params = []) {
			const rows = db.prepare(sql).all(params as unknown[]);
			return rows as never[];
		}
	};
}
