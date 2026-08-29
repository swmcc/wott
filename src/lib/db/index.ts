export type {
	CheckinRow,
	ContentType,
	ContinueWatchingRow,
	EpisodeRow,
	Focus,
	NewCheckin,
	ShowRow,
	SyncState
} from './types';
export type { SqlDriver } from './driver';
export { withTransaction } from './driver';
export { MIGRATIONS, migrate } from './migrations';
export { createDal, type Dal } from './dal';
export { openCapacitorDriver } from './capacitor-driver';

import { createDal, type Dal } from './dal';
import { openCapacitorDriver } from './capacitor-driver';
import { migrate } from './migrations';

/** Open the on-device database, bring the schema up to date, hand back the DAL. */
export async function initDb(): Promise<Dal> {
	const driver = await openCapacitorDriver();
	await migrate(driver);
	return createDal(driver);
}
