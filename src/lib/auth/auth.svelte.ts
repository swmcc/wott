import { API_BASE } from '../api/config';
import { createApiClient, type ApiClient } from '../api/client';
import { createSecureTokenStore, getStoredUser, setStoredUser } from './secure-token-store';
import type { User } from './user';

export type { User };

/** `unknown` until `restoreSession()` has decided; the layout splashes on it. */
export type AuthStatus = 'unknown' | 'anon' | 'authed';

interface LoginResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	user: User;
}

const store = createSecureTokenStore();

let status = $state<AuthStatus>('unknown');
let user = $state<User | null>(null);

export const auth: { readonly status: AuthStatus; readonly user: User | null } = {
	get status() {
		return status;
	},
	get user() {
		return user;
	}
};

export const api: ApiClient = createApiClient({
	baseUrl: API_BASE,
	store,
	onSessionExpired: () => {
		status = 'anon';
		user = null;
	}
});

export async function login(email: string, password: string): Promise<void> {
	const result = await api.json<LoginResponse>('/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});

	await store.setTokens({
		accessToken: result.access_token,
		refreshToken: result.refresh_token
	});
	await setStoredUser(result.user);

	user = result.user;
	status = 'authed';
}

export async function logout(): Promise<void> {
	// `POST /auth/logout` is a no-op server-side; logging out is deleting the tokens.
	await store.clear();
	user = null;
	status = 'anon';
}

/**
 * Local-first restore: if we hold tokens we go straight to `authed` with the
 * cached user so the first frame is never network-bound, then reconcile
 * against `GET /auth/me` in the background. Only a failed refresh (which
 * arrives via `onSessionExpired`) demotes the session — a flat network keeps it.
 */
export async function restoreSession(): Promise<void> {
	const tokens = await store.getTokens();
	if (!tokens) {
		user = null;
		status = 'anon';
		return;
	}

	user = await getStoredUser();
	status = 'authed';

	try {
		const fresh = await api.json<User>('/auth/me');
		if (status === 'authed') {
			user = fresh;
			await setStoredUser(fresh);
		}
	} catch {
		// A 401 whose refresh also failed has already flipped us to `anon` via
		// `onSessionExpired`. Anything else (offline, DNS, 5xx) leaves the local
		// session intact — the network is never in front of the user.
	}
}
