import { describe, expect, it } from 'vitest';
import type { ApiClient } from './client';
import {
	createCheckin,
	episodeCode,
	getContinueWatching,
	groupByDay,
	listRecentCheckins,
	type Checkin
} from './checkins';

function fakeApi(routes: Record<string, unknown>): ApiClient & { calls: RequestInit[] } {
	const calls: RequestInit[] = [];
	return {
		calls,
		async json<T>(path: string, init?: RequestInit): Promise<T> {
			calls.push(init ?? {});
			if (!(path in routes)) throw new Error(`unexpected path ${path}`);
			return routes[path] as T;
		},
		async request() {
			throw new Error('not used');
		}
	};
}

function checkin(id: number, watchedAt: string): Checkin {
	return {
		id,
		watched_at: watchedAt,
		location: null,
		watched_with: null,
		notes: null,
		focus: null,
		content: {
			id: 1,
			tvdb_id: 100,
			name: 'Show',
			content_type: 'series',
			year: 2020,
			poster_url: null,
			image_url: null
		},
		episode: null
	};
}

describe('checkins api', () => {
	it('fetches continue-watching', async () => {
		const payload = { items: [], generated_at: 'now' };
		const api = fakeApi({ '/checkins/continue-watching': payload });
		expect(await getContinueWatching(api)).toEqual(payload);
	});

	it('lists recent check-ins with the days param', async () => {
		const api = fakeApi({ '/checkins?days=3': [] });
		expect(await listRecentCheckins(api, 3)).toEqual([]);
	});

	it('POSTs a check-in with TVDB ids and watched_at', async () => {
		const api = fakeApi({ '/checkins': checkin(1, '2026-08-29T20:00:00Z') });
		await createCheckin(api, {
			content_id: 431162,
			episode_id: 9187556,
			watched_at: '2026-08-29T20:00:00Z'
		});
		expect(api.calls[0].method).toBe('POST');
		expect(JSON.parse(api.calls[0].body as string)).toEqual({
			content_id: 431162,
			episode_id: 9187556,
			watched_at: '2026-08-29T20:00:00Z'
		});
	});

	it('formats episode codes', () => {
		expect(episodeCode({ season_number: 2, episode_number: 5 })).toBe('S2 E5');
	});

	it('groups check-ins by local day, preserving order', () => {
		const groups = groupByDay([
			checkin(1, '2026-08-29T21:00:00'),
			checkin(2, '2026-08-29T19:00:00'),
			checkin(3, '2026-08-28T22:00:00')
		]);
		expect(groups).toHaveLength(2);
		expect(groups[0].checkins.map((c) => c.id)).toEqual([1, 2]);
		expect(groups[1].checkins.map((c) => c.id)).toEqual([3]);
	});
});
