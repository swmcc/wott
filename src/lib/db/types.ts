/**
 * Row shapes for the local SQLite store (PLAN.md §6).
 *
 * Everything is keyed by TVDB id — the server's internal `id` fields are never
 * persisted, with one exception: `CheckinRow.serverId`, the check-in's own
 * server id, which we need for later PATCH/DELETE.
 *
 * All timestamps are ISO-8601 strings (stored as SQLite TEXT).
 */

export type SyncState = 'pending' | 'synced' | 'failed';

export type ContentType = 'series' | 'movie';

export type Focus = 'focused' | 'distracted' | 'background' | 'sleep';

export interface ShowRow {
	tvdbId: number;
	name: string;
	contentType: ContentType;
	year: number | null;
	imageUrl: string | null;
	lastSyncedAt: string | null;
}

export interface EpisodeRow {
	tvdbId: number;
	showTvdbId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	aired: string | null;
	runtime: number | null;
	imageUrl: string | null;
}

export interface CheckinRow {
	clientUuid: string;
	serverId: number | null;
	contentTvdbId: number;
	episodeTvdbId: number | null;
	watchedAt: string;
	location: string | null;
	watchedWith: string | null;
	notes: string | null;
	focus: Focus | null;
	syncState: SyncState;
	createdAt: string;
	updatedAt: string;
}

/** What a screen hands to `dal.checkins.createLocal` — the rest is filled in locally. */
export interface NewCheckin {
	contentTvdbId: number;
	episodeTvdbId?: number | null;
	watchedAt: string;
	location?: string | null;
	watchedWith?: string | null;
	notes?: string | null;
	focus?: Focus | null;
}

export interface ContinueWatchingRow {
	showTvdbId: number;
	nextEpisodeTvdbId: number | null;
	position: number;
}
