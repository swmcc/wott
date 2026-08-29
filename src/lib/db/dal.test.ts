import { beforeEach, describe, expect, it } from 'vitest';
import { createDal, type Dal } from './dal';
import type { SqlDriver } from './driver';
import { migrate } from './migrations';
import { createMemoryDriver } from './testing/memory-driver';
import type { EpisodeRow, ShowRow } from './types';

const show = (over: Partial<ShowRow> = {}): ShowRow => ({
	tvdbId: 371980,
	name: 'Severance',
	contentType: 'series',
	year: 2022,
	imageUrl: 'https://example.test/severance.jpg',
	lastSyncedAt: '2026-08-29T10:00:00.000Z',
	...over
});

const episode = (over: Partial<EpisodeRow> = {}): EpisodeRow => ({
	tvdbId: 8280001,
	showTvdbId: 371980,
	seasonNumber: 1,
	episodeNumber: 1,
	name: 'Good News About Hell',
	aired: '2022-02-18',
	runtime: 57,
	imageUrl: null,
	...over
});

let driver: SqlDriver;
let dal: Dal;

beforeEach(async () => {
	driver = createMemoryDriver();
	await migrate(driver);
	dal = createDal(driver);
});

describe('shows', () => {
	it('round-trips a show', async () => {
		await dal.shows.upsertMany([show()]);
		expect(await dal.shows.get(371980)).toEqual(show());
	});

	it('returns null for an unknown tvdb id', async () => {
		expect(await dal.shows.get(999)).toBeNull();
	});

	it('updates on tvdb_id conflict rather than duplicating', async () => {
		await dal.shows.upsertMany([show()]);
		await dal.shows.upsertMany([show({ name: 'Severance (2022)', lastSyncedAt: null })]);

		const rows = await driver.query('SELECT * FROM shows');
		expect(rows).toHaveLength(1);
		expect((await dal.shows.get(371980))?.name).toBe('Severance (2022)');
	});
});

describe('episodes', () => {
	beforeEach(async () => {
		await dal.shows.upsertMany([show()]);
	});

	it('round-trips an episode', async () => {
		await dal.episodes.upsertMany([episode()]);
		expect(await dal.episodes.get(8280001)).toEqual(episode());
	});

	it('lists a show ordered by season then episode', async () => {
		await dal.episodes.upsertMany([
			episode({ tvdbId: 3, seasonNumber: 2, episodeNumber: 1 }),
			episode({ tvdbId: 2, seasonNumber: 1, episodeNumber: 2 }),
			episode({ tvdbId: 1, seasonNumber: 1, episodeNumber: 1 })
		]);

		const listed = await dal.episodes.listByShow(371980);
		expect(listed.map((e) => e.tvdbId)).toEqual([1, 2, 3]);
	});

	it('filters by season when asked', async () => {
		await dal.episodes.upsertMany([
			episode({ tvdbId: 1, seasonNumber: 1, episodeNumber: 1 }),
			episode({ tvdbId: 3, seasonNumber: 2, episodeNumber: 1 })
		]);

		const listed = await dal.episodes.listByShow(371980, 2);
		expect(listed.map((e) => e.tvdbId)).toEqual([3]);
	});

	it('updates on tvdb_id conflict', async () => {
		await dal.episodes.upsertMany([episode()]);
		await dal.episodes.upsertMany([episode({ name: 'Good News About Hell (remastered)' })]);

		expect((await dal.episodes.get(8280001))?.name).toBe('Good News About Hell (remastered)');
	});
});

describe('checkins', () => {
	it('createLocal generates a uuid and starts pending', async () => {
		const row = await dal.checkins.createLocal({
			contentTvdbId: 371980,
			episodeTvdbId: 8280001,
			watchedAt: '2026-08-28T21:00:00.000Z',
			focus: 'focused'
		});

		expect(row.clientUuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(row).toMatchObject({
			serverId: null,
			syncState: 'pending',
			episodeTvdbId: 8280001,
			focus: 'focused',
			location: null,
			notes: null,
			watchedWith: null
		});
		expect(row.createdAt).toBe(row.updatedAt);
	});

	it('persists what createLocal returned', async () => {
		const row = await dal.checkins.createLocal({
			contentTvdbId: 371980,
			watchedAt: '2026-08-28T21:00:00.000Z'
		});

		const stored = await dal.checkins.listForContent(371980);
		expect(stored).toEqual([row]);
	});

	it('markSynced records the server id and flips state', async () => {
		const row = await dal.checkins.createLocal({
			contentTvdbId: 371980,
			watchedAt: '2026-08-28T21:00:00.000Z'
		});
		await dal.checkins.markSynced(row.clientUuid, 4242);

		const [stored] = await dal.checkins.listForContent(371980);
		expect(stored).toMatchObject({ serverId: 4242, syncState: 'synced' });
	});

	it('markFailed flips state to failed', async () => {
		const row = await dal.checkins.createLocal({
			contentTvdbId: 371980,
			watchedAt: '2026-08-28T21:00:00.000Z'
		});
		await dal.checkins.markFailed(row.clientUuid);

		const [stored] = await dal.checkins.listForContent(371980);
		expect(stored.syncState).toBe('failed');
	});

	it('listPending returns only pending check-ins, oldest first', async () => {
		await seedCheckin('a', { createdAt: '2026-08-01T00:00:00.000Z' });
		await seedCheckin('b', { createdAt: '2026-08-03T00:00:00.000Z' });
		await seedCheckin('c', { createdAt: '2026-08-02T00:00:00.000Z' });
		await dal.checkins.markSynced('c', 1);

		const pending = await dal.checkins.listPending();
		expect(pending.map((c) => c.clientUuid)).toEqual(['a', 'b']);
	});

	it('listRecent is watched_at DESC and honours the limit', async () => {
		await seedCheckin('old', { watchedAt: '2026-08-01T00:00:00.000Z' });
		await seedCheckin('new', { watchedAt: '2026-08-05T00:00:00.000Z' });
		await seedCheckin('mid', { watchedAt: '2026-08-03T00:00:00.000Z' });

		const recent = await dal.checkins.listRecent(2);
		expect(recent.map((c) => c.clientUuid)).toEqual(['new', 'mid']);
	});

	it('listForContent filters by content tvdb id', async () => {
		await seedCheckin('mine', { contentTvdbId: 371980 });
		await seedCheckin('other', { contentTvdbId: 121361 });

		const rows = await dal.checkins.listForContent(371980);
		expect(rows.map((c) => c.clientUuid)).toEqual(['mine']);
	});

	it('rejects a sync_state outside the allowed set', async () => {
		await expect(
			seedCheckin('bad', { syncState: 'halfway' as unknown as 'pending' })
		).rejects.toThrow(/CHECK constraint/i);
	});
});

describe('continueWatching', () => {
	beforeEach(async () => {
		await dal.shows.upsertMany([show(), show({ tvdbId: 121361, name: 'Game of Thrones' })]);
	});

	it('replaceAll fully replaces the list and list() honours position', async () => {
		await dal.continueWatching.replaceAll([
			{ showTvdbId: 121361, nextEpisodeTvdbId: 7, position: 1 },
			{ showTvdbId: 371980, nextEpisodeTvdbId: null, position: 0 }
		]);
		expect((await dal.continueWatching.list()).map((r) => r.showTvdbId)).toEqual([371980, 121361]);

		await dal.continueWatching.replaceAll([
			{ showTvdbId: 121361, nextEpisodeTvdbId: 8, position: 0 }
		]);
		expect(await dal.continueWatching.list()).toEqual([
			{ showTvdbId: 121361, nextEpisodeTvdbId: 8, position: 0 }
		]);
	});

	it('replaceAll with an empty list clears the table', async () => {
		await dal.continueWatching.replaceAll([
			{ showTvdbId: 371980, nextEpisodeTvdbId: null, position: 0 }
		]);
		await dal.continueWatching.replaceAll([]);

		expect(await dal.continueWatching.list()).toEqual([]);
	});
});

describe('meta', () => {
	it('round-trips and overwrites a key', async () => {
		expect(await dal.meta.get('last_sync')).toBeNull();

		await dal.meta.set('last_sync', '2026-08-29T09:00:00.000Z');
		expect(await dal.meta.get('last_sync')).toBe('2026-08-29T09:00:00.000Z');

		await dal.meta.set('last_sync', '2026-08-29T10:00:00.000Z');
		expect(await dal.meta.get('last_sync')).toBe('2026-08-29T10:00:00.000Z');
	});
});

/** Insert a check-in with fully controlled timestamps — createLocal stamps "now". */
async function seedCheckin(
	clientUuid: string,
	over: {
		contentTvdbId?: number;
		watchedAt?: string;
		createdAt?: string;
		syncState?: 'pending' | 'synced' | 'failed';
	} = {}
) {
	const createdAt = over.createdAt ?? '2026-08-01T00:00:00.000Z';
	await driver.run(
		`INSERT INTO checkins (client_uuid, content_tvdb_id, watched_at, sync_state, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[
			clientUuid,
			over.contentTvdbId ?? 371980,
			over.watchedAt ?? '2026-08-01T20:00:00.000Z',
			over.syncState ?? 'pending',
			createdAt,
			createdAt
		]
	);
}
