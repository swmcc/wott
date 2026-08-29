import type { TokenStore, Tokens } from '../auth/token-store';

/** A non-2xx response from the API. `detail` carries FastAPI's `{"detail": …}`. */
export class ApiError extends Error {
	status: number;
	detail: string;

	constructor(status: number, detail: string) {
		super(detail);
		this.name = 'ApiError';
		this.status = status;
		this.detail = detail;
	}
}

export interface ApiClient {
	/** Fetch with `Authorization` attached and the 401 → refresh → retry dance handled. */
	request(path: string, init?: RequestInit): Promise<Response>;
	/** As `request`, but parses JSON and throws `ApiError` when the response is not ok. */
	json<T>(path: string, init?: RequestInit): Promise<T>;
}

export interface ApiClientOptions {
	baseUrl: string;
	store: TokenStore;
	fetchFn?: typeof fetch;
	onSessionExpired?: () => void;
}

function withAuth(init: RequestInit | undefined, accessToken: string | null): RequestInit {
	const headers = new Headers(init?.headers);
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	return { ...init, headers };
}

async function readDetail(response: Response): Promise<string> {
	try {
		const body: unknown = await response.clone().json();
		if (body && typeof body === 'object' && 'detail' in body) {
			const detail = (body as { detail: unknown }).detail;
			return typeof detail === 'string' ? detail : JSON.stringify(detail);
		}
	} catch {
		// Not JSON — fall through to the status text.
	}
	return response.statusText || `Request failed with status ${response.status}`;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
	const { baseUrl, store, onSessionExpired } = opts;
	const doFetch = opts.fetchFn ?? globalThis.fetch.bind(globalThis);

	// Concurrent 401s share a single in-flight refresh so we never stampede
	// `/auth/refresh` — the backend rotates refresh tokens, so a second call
	// with the same (now spent) token would fail.
	let refreshInFlight: Promise<Tokens | null> | null = null;

	async function performRefresh(refreshToken: string): Promise<Tokens | null> {
		let response: Response;
		try {
			// Deliberately no Authorization header: `/auth/refresh` rejects access tokens.
			response = await doFetch(`${baseUrl}/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken })
			});
		} catch {
			return null;
		}
		if (!response.ok) return null;

		try {
			const body = (await response.json()) as { access_token?: string; refresh_token?: string };
			if (!body.access_token || !body.refresh_token) return null;
			const rotated: Tokens = {
				accessToken: body.access_token,
				refreshToken: body.refresh_token
			};
			await store.setTokens(rotated);
			return rotated;
		} catch {
			return null;
		}
	}

	function refreshOnce(refreshToken: string): Promise<Tokens | null> {
		refreshInFlight ??= performRefresh(refreshToken).finally(() => {
			refreshInFlight = null;
		});
		return refreshInFlight;
	}

	async function request(path: string, init?: RequestInit): Promise<Response> {
		const tokens = await store.getTokens();
		const response = await doFetch(
			`${baseUrl}${path}`,
			withAuth(init, tokens?.accessToken ?? null)
		);

		if (response.status !== 401 || !tokens) return response;

		const rotated = await refreshOnce(tokens.refreshToken);
		if (!rotated) {
			await store.clear();
			onSessionExpired?.();
			return response;
		}

		// Exactly one retry — a second 401 is surfaced as-is, never re-refreshed.
		return doFetch(`${baseUrl}${path}`, withAuth(init, rotated.accessToken));
	}

	async function json<T>(path: string, init?: RequestInit): Promise<T> {
		const response = await request(path, init);
		if (!response.ok) throw new ApiError(response.status, await readDetail(response));
		if (response.status === 204) return undefined as T;

		const text = await response.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	return { request, json };
}
