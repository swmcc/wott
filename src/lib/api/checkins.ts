// Typed wrappers for the check-in endpoints the app uses. Shapes mirror
// API.md exactly — requests use TVDB ids, responses carry both tvdb_id and
// internal ids (which we never persist).
import type { ApiClient } from './client';

export interface ContentSummary {
	id: number;
	tvdb_id: number;
	name: string;
	content_type: 'series' | 'movie';
	year: number | null;
	poster_url: string | null;
	image_url: string | null;
}

export interface EpisodeSummary {
	id: number;
	tvdb_id: number;
	name: string | null;
	season_number: number;
	episode_number: number;
	image_url: string | null;
}

export interface Checkin {
	id: number;
	watched_at: string;
	location: string | null;
	watched_with: string | null;
	notes: string | null;
	focus: string | null;
	content: ContentSummary;
	episode: EpisodeSummary | null;
}

export interface ContinueWatchingItem {
	content: {
		tvdb_id: number;
		name: string;
		content_type: 'series' | 'movie';
		year: number | null;
		image_url: string | null;
	};
	next_episode: {
		tvdb_id: number;
		name: string | null;
		season_number: number;
		episode_number: number;
		aired: string | null;
		runtime: number | null;
		image_url: string | null;
	} | null;
	last_watched_at: string;
	watched_episodes: number;
	total_episodes: number;
}

export interface ContinueWatchingResponse {
	items: ContinueWatchingItem[];
	generated_at: string;
}

export interface CreateCheckinRequest {
	content_id: number; // TVDB id
	// TVDB movie and series ids are separate namespaces that can collide;
	// without this the server guesses movie-first and can resolve the wrong title
	content_type: 'series' | 'movie';
	episode_id?: number | null; // TVDB id
	watched_at: string; // ISO 8601
}

export function getContinueWatching(api: ApiClient): Promise<ContinueWatchingResponse> {
	return api.json<ContinueWatchingResponse>('/checkins/continue-watching');
}

export function listRecentCheckins(api: ApiClient, days = 10): Promise<Checkin[]> {
	return api.json<Checkin[]>(`/checkins?days=${days}`);
}

export function createCheckin(api: ApiClient, req: CreateCheckinRequest): Promise<Checkin> {
	return api.json<Checkin>('/checkins', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(req)
	});
}

/** "S2 E5" — the universal episode shorthand. */
export function episodeCode(e: { season_number: number; episode_number: number }): string {
	return `S${e.season_number} E${e.episode_number}`;
}

/** Group check-ins by local calendar day, newest day first (API.md: grouping is client-side). */
export function groupByDay(checkins: Checkin[]): { day: string; checkins: Checkin[] }[] {
	const groups = new Map<string, Checkin[]>();
	for (const c of checkins) {
		const day = new Date(c.watched_at).toDateString();
		const list = groups.get(day);
		if (list) list.push(c);
		else groups.set(day, [c]);
	}
	return [...groups.entries()].map(([day, list]) => ({ day, checkins: list }));
}
