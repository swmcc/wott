export interface Tokens {
	accessToken: string;
	refreshToken: string;
}

export interface TokenStore {
	getTokens(): Promise<Tokens | null>;
	setTokens(tokens: Tokens): Promise<void>;
	clear(): Promise<void>;
}

/**
 * An in-memory TokenStore. Used by tests and as a safe fallback; the app
 * itself always uses the Secure Storage backed store (iOS evicts web
 * storage, so tokens must never live in localStorage).
 */
export function createMemoryTokenStore(): TokenStore {
	let tokens: Tokens | null = null;

	return {
		async getTokens() {
			return tokens;
		},
		async setTokens(next: Tokens) {
			tokens = { ...next };
		},
		async clear() {
			tokens = null;
		}
	};
}
