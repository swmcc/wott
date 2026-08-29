import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './migrations';
import { createMemoryDriver } from './testing/memory-driver';

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

async function tableNames(driver: ReturnType<typeof createMemoryDriver>) {
	const rows = await driver.query<{ name: string }>(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
	);
	return rows.map((r) => r.name);
}

describe('migrate', () => {
	it('creates every table on an empty database', async () => {
		const driver = createMemoryDriver();
		await migrate(driver);

		expect(await tableNames(driver)).toEqual([
			'checkins',
			'continue_watching',
			'episodes',
			'meta',
			'shows'
		]);
	});

	it('records the schema version in user_version and meta', async () => {
		const driver = createMemoryDriver();
		await migrate(driver);

		const pragma = await driver.query<{ user_version: number }>('PRAGMA user_version');
		expect(pragma[0].user_version).toBe(LATEST);

		const meta = await driver.query<{ value: string }>(
			`SELECT value FROM meta WHERE key = 'schema_version'`
		);
		expect(meta[0].value).toBe(String(LATEST));
	});

	it('is idempotent — a second run changes nothing', async () => {
		const driver = createMemoryDriver();
		await migrate(driver);
		await driver.run(
			`INSERT INTO shows (tvdb_id, name, content_type) VALUES (1, 'Severance', 'series')`
		);

		await expect(migrate(driver)).resolves.toBeUndefined();

		const rows = await driver.query<{ name: string }>('SELECT name FROM shows');
		expect(rows).toEqual([{ name: 'Severance' }]);
	});

	it('creates the expected indexes', async () => {
		const driver = createMemoryDriver();
		await migrate(driver);

		const rows = await driver.query<{ name: string }>(
			`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name`
		);
		expect(rows.map((r) => r.name)).toEqual([
			'idx_checkins_content',
			'idx_checkins_sync',
			'idx_checkins_watched',
			'idx_episodes_show'
		]);
	});
});
