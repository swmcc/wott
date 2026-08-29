import { withTransaction, type SqlDriver } from './driver';

/**
 * Versioned schema for the local store (PLAN.md §6). Migrations are append-only:
 * never edit a shipped migration, add the next one.
 */
export const MIGRATIONS: { version: number; statements: string[] }[] = [
	{
		version: 1,
		statements: [
			`CREATE TABLE shows (
				tvdb_id INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				content_type TEXT NOT NULL CHECK (content_type IN ('series','movie')),
				year INTEGER,
				image_url TEXT,
				last_synced_at TEXT
			)`,
			`CREATE TABLE episodes (
				tvdb_id INTEGER PRIMARY KEY,
				show_tvdb_id INTEGER NOT NULL REFERENCES shows(tvdb_id),
				season_number INTEGER NOT NULL,
				episode_number INTEGER NOT NULL,
				name TEXT,
				aired TEXT,
				runtime INTEGER,
				image_url TEXT
			)`,
			`CREATE INDEX idx_episodes_show ON episodes(show_tvdb_id, season_number, episode_number)`,
			`CREATE TABLE checkins (
				client_uuid TEXT PRIMARY KEY,
				server_id INTEGER UNIQUE,
				content_tvdb_id INTEGER NOT NULL,
				episode_tvdb_id INTEGER,
				watched_at TEXT NOT NULL,
				location TEXT,
				watched_with TEXT,
				notes TEXT,
				focus TEXT CHECK (focus IN ('focused','distracted','background','sleep')),
				sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','failed')),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE INDEX idx_checkins_sync ON checkins(sync_state)`,
			`CREATE INDEX idx_checkins_watched ON checkins(watched_at DESC)`,
			`CREATE INDEX idx_checkins_content ON checkins(content_tvdb_id)`,
			`CREATE TABLE continue_watching (
				show_tvdb_id INTEGER PRIMARY KEY REFERENCES shows(tvdb_id),
				next_episode_tvdb_id INTEGER,
				position INTEGER NOT NULL
			)`,
			`CREATE TABLE meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)`
		]
	}
];

async function currentVersion(driver: SqlDriver): Promise<number> {
	const rows = await driver.query<{ user_version?: number }>('PRAGMA user_version');
	return rows[0]?.user_version ?? 0;
}

/**
 * Bring the database up to the latest schema version. Gated on
 * `PRAGMA user_version`, so running it on every launch is cheap and idempotent.
 */
export async function migrate(driver: SqlDriver): Promise<void> {
	const from = await currentVersion(driver);

	for (const migration of MIGRATIONS) {
		if (migration.version <= from) continue;

		await withTransaction(driver, async () => {
			for (const statement of migration.statements) {
				await driver.run(statement);
			}
			await driver.run(
				`INSERT INTO meta (key, value) VALUES ('schema_version', ?)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
				[String(migration.version)]
			);
			// PRAGMA can't be parameterised; the value is a literal from MIGRATIONS.
			await driver.run(`PRAGMA user_version = ${migration.version}`);
		});
	}
}
