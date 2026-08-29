/**
 * The seam between the data-access layer and whatever is actually executing
 * SQL: the Capacitor plugin on device, better-sqlite3 in unit tests.
 */
export interface SqlDriver {
	run(sql: string, params?: unknown[]): Promise<void>;
	query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Run `fn` inside BEGIN/COMMIT, rolling back if it throws. */
export async function withTransaction<T>(driver: SqlDriver, fn: () => Promise<T>): Promise<T> {
	await driver.run('BEGIN');
	try {
		const result = await fn();
		await driver.run('COMMIT');
		return result;
	} catch (error) {
		await driver.run('ROLLBACK');
		throw error;
	}
}
