import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
import { createMemoryTokenStore } from '../auth/token-store';

const BASE = 'http://localhost:8000/api';

type Call = { url: string; init?: RequestInit };
type Handler = (url: string, init: RequestInit | undefined, call: number) => Response;

function mockFetch(handler: Handler) {
	const calls: Call[] = [];
	const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = String(input);
		calls.push({ url, init });
		// Always yield the microtask queue so concurrent callers interleave the
		// way they would against a real network.
		await Promise.resolve();
		return handler(url, init, calls.length - 1);
	};
	return { fn: fn as unknown as typeof fetch, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function authHeader(call: Call | undefined): string | null {
	return new Headers(call?.init?.headers).get('Authorization');
}

async function storeWithTokens() {
	const store = createMemoryTokenStore();
	await store.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
	return store;
}

describe('createApiClient', () => {
	it('attaches the bearer token from the store', async () => {
		const store = await storeWithTokens();
		const { fn, calls } = mockFetch(() => jsonResponse({ id: 1 }));
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		const user = await client.json<{ id: number }>('/auth/me');

		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`${BASE}/auth/me`);
		expect(authHeader(calls[0])).toBe('Bearer access-1');
		expect(user).toEqual({ id: 1 });
	});

	it('sends no Authorization header and never refreshes when there are no tokens', async () => {
		const store = createMemoryTokenStore();
		const { fn, calls } = mockFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		const response = await client.request('/auth/me');

		expect(response.status).toBe(401);
		expect(calls).toHaveLength(1);
		expect(authHeader(calls[0])).toBeNull();
	});

	it('refreshes on 401, persists the rotated pair and retries the original once', async () => {
		const store = await storeWithTokens();
		const { fn, calls } = mockFetch((url, _init, call) => {
			if (url.endsWith('/auth/refresh')) {
				return jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2' });
			}
			return call === 0
				? jsonResponse({ detail: 'Not authenticated' }, 401)
				: jsonResponse({ id: 1 });
		});
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		const user = await client.json<{ id: number }>('/auth/me');

		expect(user).toEqual({ id: 1 });
		expect(calls.map((c) => c.url)).toEqual([
			`${BASE}/auth/me`,
			`${BASE}/auth/refresh`,
			`${BASE}/auth/me`
		]);
		// The refresh call itself must not carry an access token.
		expect(authHeader(calls[1])).toBeNull();
		expect(JSON.parse(String(calls[1].init?.body))).toEqual({ refresh_token: 'refresh-1' });
		// The retry uses the rotated access token, and both new tokens are stored.
		expect(authHeader(calls[2])).toBe('Bearer access-2');
		await expect(store.getTokens()).resolves.toEqual({
			accessToken: 'access-2',
			refreshToken: 'refresh-2'
		});
	});

	it('clears the store, fires onSessionExpired and surfaces the original 401 when refresh fails', async () => {
		const store = await storeWithTokens();
		const onSessionExpired = vi.fn();
		const { fn, calls } = mockFetch((url) =>
			url.endsWith('/auth/refresh')
				? jsonResponse({ detail: 'Invalid refresh token' }, 401)
				: jsonResponse({ detail: 'Not authenticated' }, 401)
		);
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn, onSessionExpired });

		await expect(client.json('/auth/me')).rejects.toMatchObject({
			status: 401,
			detail: 'Not authenticated'
		});
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		await expect(store.getTokens()).resolves.toBeNull();
		// One attempt, one refresh, no retry — never a loop.
		expect(calls).toHaveLength(2);
	});

	it('treats a network failure during refresh as a dead session', async () => {
		const store = await storeWithTokens();
		const onSessionExpired = vi.fn();
		const fn = (async (input: RequestInfo | URL) => {
			if (String(input).endsWith('/auth/refresh')) throw new TypeError('Failed to fetch');
			return jsonResponse({ detail: 'Not authenticated' }, 401);
		}) as unknown as typeof fetch;
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn, onSessionExpired });

		const response = await client.request('/auth/me');

		expect(response.status).toBe(401);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		await expect(store.getTokens()).resolves.toBeNull();
	});

	it('shares a single in-flight refresh between concurrent 401s', async () => {
		const store = await storeWithTokens();
		const seen: string[] = [];
		const { fn, calls } = mockFetch((url) => {
			seen.push(url);
			if (url.endsWith('/auth/refresh')) {
				return jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2' });
			}
			// Anything still presenting the stale token gets a 401.
			return seen.filter((u) => u.endsWith('/auth/refresh')).length === 0
				? jsonResponse({ detail: 'Not authenticated' }, 401)
				: jsonResponse({ ok: true });
		});
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		const [a, b] = await Promise.all([
			client.json<{ ok: boolean }>('/continue-watching'),
			client.json<{ ok: boolean }>('/checkins')
		]);

		expect(a).toEqual({ ok: true });
		expect(b).toEqual({ ok: true });
		expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
		expect(calls).toHaveLength(5);
	});

	it('surfaces non-401 failures as an ApiError carrying the FastAPI detail', async () => {
		const store = await storeWithTokens();
		const { fn, calls } = mockFetch(() =>
			jsonResponse({ detail: 'Please ensure the series and its episodes are loaded' }, 404)
		);
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		const error = await client.json('/checkins').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 404,
			detail: 'Please ensure the series and its episodes are loaded'
		});
		// No refresh attempted for a non-401.
		expect(calls).toHaveLength(1);
	});

	it('falls back to the status text when the error body is not FastAPI JSON', async () => {
		const store = await storeWithTokens();
		const { fn } = mockFetch(() => new Response('<html>502</html>', { status: 502 }));
		const client = createApiClient({ baseUrl: BASE, store, fetchFn: fn });

		await expect(client.json('/checkins')).rejects.toMatchObject({ status: 502 });
	});
});
