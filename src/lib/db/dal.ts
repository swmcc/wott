import { withTransaction, type SqlDriver } from './driver';
import type {
	CheckinRow,
	ContentType,
	ContinueWatchingRow,
	EpisodeRow,
	Focus,
	NewCheckin,
	ShowRow,
	SyncState
} from './types';

export interface Dal {
	shows: {
		upsertMany(rows: ShowRow[]): Promise<void>;
		get(tvdbId: number): Promise<ShowRow | null>;
	};
	episodes: {
		upsertMany(rows: EpisodeRow[]): Promise<void>;
		get(tvdbId: number): Promise<EpisodeRow | null>;
		listByShow(showTvdbId: number, seasonNumber?: number): Promise<EpisodeRow[]>;
	};
	checkins: {
		createLocal(input: NewCheckin): Promise<CheckinRow>;
		markSynced(clientUuid: string, serverId: number): Promise<void>;
		markFailed(clientUuid: string): Promise<void>;
		listPending(): Promise<CheckinRow[]>;
		listRecent(limit: number): Promise<CheckinRow[]>;
		listForContent(contentTvdbId: number): Promise<CheckinRow[]>;
	};
	continueWatching: {
		replaceAll(rows: ContinueWatchingRow[]): Promise<void>;
		list(): Promise<ContinueWatchingRow[]>;
	};
	meta: {
		get(key: string): Promise<string | null>;
		set(key: string, value: string): Promise<void>;
	};
}

interface ShowRecord {
	tvdb_id: number;
	name: string;
	content_type: ContentType;
	year: number | null;
	image_url: string | null;
	last_synced_at: string | null;
}

interface EpisodeRecord {
	tvdb_id: number;
	show_tvdb_id: number;
	season_number: number;
	episode_number: number;
	name: string | null;
	aired: string | null;
	runtime: number | null;
	image_url: string | null;
}

interface CheckinRecord {
	client_uuid: string;
	server_id: number | null;
	content_tvdb_id: number;
	episode_tvdb_id: number | null;
	watched_at: string;
	location: string | null;
	watched_with: string | null;
	notes: string | null;
	focus: Focus | null;
	sync_state: SyncState;
	created_at: string;
	updated_at: string;
}

interface ContinueWatchingRecord {
	show_tvdb_id: number;
	next_episode_tvdb_id: number | null;
	position: number;
}

const toShow = (r: ShowRecord): ShowRow => ({
	tvdbId: r.tvdb_id,
	name: r.name,
	contentType: r.content_type,
	year: r.year,
	imageUrl: r.image_url,
	lastSyncedAt: r.last_synced_at
});

const toEpisode = (r: EpisodeRecord): EpisodeRow => ({
	tvdbId: r.tvdb_id,
	showTvdbId: r.show_tvdb_id,
	seasonNumber: r.season_number,
	episodeNumber: r.episode_number,
	name: r.name,
	aired: r.aired,
	runtime: r.runtime,
	imageUrl: r.image_url
});

const toCheckin = (r: CheckinRecord): CheckinRow => ({
	clientUuid: r.client_uuid,
	serverId: r.server_id,
	contentTvdbId: r.content_tvdb_id,
	episodeTvdbId: r.episode_tvdb_id,
	watchedAt: r.watched_at,
	location: r.location,
	watchedWith: r.watched_with,
	notes: r.notes,
	focus: r.focus,
	syncState: r.sync_state,
	createdAt: r.created_at,
	updatedAt: r.updated_at
});

const toContinueWatching = (r: ContinueWatchingRecord): ContinueWatchingRow => ({
	showTvdbId: r.show_tvdb_id,
	nextEpisodeTvdbId: r.next_episode_tvdb_id,
	position: r.position
});

const CHECKIN_COLUMNS = `client_uuid, server_id, content_tvdb_id, episode_tvdb_id, watched_at,
	location, watched_with, notes, focus, sync_state, created_at, updated_at`;

/** Typed data-access layer over a `SqlDriver`; maps snake_case columns to camelCase rows. */
export function createDal(driver: SqlDriver): Dal {
	return {
		shows: {
			async upsertMany(rows) {
				if (rows.length === 0) return;
				await withTransaction(driver, async () => {
					for (const row of rows) {
						await driver.run(
							`INSERT INTO shows (tvdb_id, name, content_type, year, image_url, last_synced_at)
							 VALUES (?, ?, ?, ?, ?, ?)
							 ON CONFLICT(tvdb_id) DO UPDATE SET
								name = excluded.name,
								content_type = excluded.content_type,
								year = excluded.year,
								image_url = excluded.image_url,
								last_synced_at = excluded.last_synced_at`,
							[row.tvdbId, row.name, row.contentType, row.year, row.imageUrl, row.lastSyncedAt]
						);
					}
				});
			},
			async get(tvdbId) {
				const rows = await driver.query<ShowRecord>('SELECT * FROM shows WHERE tvdb_id = ?', [
					tvdbId
				]);
				return rows.length > 0 ? toShow(rows[0]) : null;
			}
		},

		episodes: {
			async upsertMany(rows) {
				if (rows.length === 0) return;
				await withTransaction(driver, async () => {
					for (const row of rows) {
						await driver.run(
							`INSERT INTO episodes (tvdb_id, show_tvdb_id, season_number, episode_number,
								name, aired, runtime, image_url)
							 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
							 ON CONFLICT(tvdb_id) DO UPDATE SET
								show_tvdb_id = excluded.show_tvdb_id,
								season_number = excluded.season_number,
								episode_number = excluded.episode_number,
								name = excluded.name,
								aired = excluded.aired,
								runtime = excluded.runtime,
								image_url = excluded.image_url`,
							[
								row.tvdbId,
								row.showTvdbId,
								row.seasonNumber,
								row.episodeNumber,
								row.name,
								row.aired,
								row.runtime,
								row.imageUrl
							]
						);
					}
				});
			},
			async get(tvdbId) {
				const rows = await driver.query<EpisodeRecord>('SELECT * FROM episodes WHERE tvdb_id = ?', [
					tvdbId
				]);
				return rows.length > 0 ? toEpisode(rows[0]) : null;
			},
			async listByShow(showTvdbId, seasonNumber) {
				const rows =
					seasonNumber === undefined
						? await driver.query<EpisodeRecord>(
								`SELECT * FROM episodes WHERE show_tvdb_id = ?
								 ORDER BY season_number ASC, episode_number ASC`,
								[showTvdbId]
							)
						: await driver.query<EpisodeRecord>(
								`SELECT * FROM episodes WHERE show_tvdb_id = ? AND season_number = ?
								 ORDER BY season_number ASC, episode_number ASC`,
								[showTvdbId, seasonNumber]
							);
				return rows.map(toEpisode);
			}
		},

		checkins: {
			async createLocal(input) {
				// createdAt/updatedAt are "now" — watchedAt is when the user says they watched it.
				const now = new Date().toISOString();
				const row: CheckinRow = {
					clientUuid: crypto.randomUUID(),
					serverId: null,
					contentTvdbId: input.contentTvdbId,
					episodeTvdbId: input.episodeTvdbId ?? null,
					watchedAt: input.watchedAt,
					location: input.location ?? null,
					watchedWith: input.watchedWith ?? null,
					notes: input.notes ?? null,
					focus: input.focus ?? null,
					syncState: 'pending',
					createdAt: now,
					updatedAt: now
				};
				await driver.run(
					`INSERT INTO checkins (${CHECKIN_COLUMNS})
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.clientUuid,
						row.serverId,
						row.contentTvdbId,
						row.episodeTvdbId,
						row.watchedAt,
						row.location,
						row.watchedWith,
						row.notes,
						row.focus,
						row.syncState,
						row.createdAt,
						row.updatedAt
					]
				);
				return row;
			},
			async markSynced(clientUuid, serverId) {
				await driver.run(
					`UPDATE checkins SET server_id = ?, sync_state = 'synced', updated_at = ?
					 WHERE client_uuid = ?`,
					[serverId, new Date().toISOString(), clientUuid]
				);
			},
			async markFailed(clientUuid) {
				await driver.run(
					`UPDATE checkins SET sync_state = 'failed', updated_at = ? WHERE client_uuid = ?`,
					[new Date().toISOString(), clientUuid]
				);
			},
			async listPending() {
				// Oldest first: the sync queue flushes in the order the user made them.
				const rows = await driver.query<CheckinRecord>(
					`SELECT * FROM checkins WHERE sync_state = 'pending' ORDER BY created_at ASC`
				);
				return rows.map(toCheckin);
			},
			async listRecent(limit) {
				const rows = await driver.query<CheckinRecord>(
					'SELECT * FROM checkins ORDER BY watched_at DESC LIMIT ?',
					[limit]
				);
				return rows.map(toCheckin);
			},
			async listForContent(contentTvdbId) {
				const rows = await driver.query<CheckinRecord>(
					'SELECT * FROM checkins WHERE content_tvdb_id = ? ORDER BY watched_at DESC',
					[contentTvdbId]
				);
				return rows.map(toCheckin);
			}
		},

		continueWatching: {
			async replaceAll(rows) {
				// Server-owned list: delete-then-insert so a removed show disappears.
				await withTransaction(driver, async () => {
					await driver.run('DELETE FROM continue_watching');
					for (const row of rows) {
						await driver.run(
							`INSERT INTO continue_watching (show_tvdb_id, next_episode_tvdb_id, position)
							 VALUES (?, ?, ?)`,
							[row.showTvdbId, row.nextEpisodeTvdbId, row.position]
						);
					}
				});
			},
			async list() {
				const rows = await driver.query<ContinueWatchingRecord>(
					'SELECT * FROM continue_watching ORDER BY position ASC'
				);
				return rows.map(toContinueWatching);
			}
		},

		meta: {
			async get(key) {
				const rows = await driver.query<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
					key
				]);
				return rows.length > 0 ? rows[0].value : null;
			},
			async set(key, value) {
				await driver.run(
					`INSERT INTO meta (key, value) VALUES (?, ?)
					 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
					[key, value]
				);
			}
		}
	};
}
