import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { TokenStore, Tokens } from './token-store';
import type { User } from './user';

// This is the ONLY module that talks to the secure storage plugin. Tokens live
// in the keychain/keystore, never in localStorage — iOS evicts web storage.
const ACCESS_KEY = 'wott.accessToken';
const REFRESH_KEY = 'wott.refreshToken';
const USER_KEY = 'wott.user';

export function createSecureTokenStore(): TokenStore {
	return {
		async getTokens(): Promise<Tokens | null> {
			try {
				const [accessToken, refreshToken] = await Promise.all([
					SecureStorage.getItem(ACCESS_KEY),
					SecureStorage.getItem(REFRESH_KEY)
				]);
				if (!accessToken || !refreshToken) return null;
				return { accessToken, refreshToken };
			} catch {
				// A store-level failure is indistinguishable from "no session" as far
				// as the app is concerned: send the user to the login screen.
				return null;
			}
		},

		async setTokens(tokens: Tokens): Promise<void> {
			await SecureStorage.setItem(ACCESS_KEY, tokens.accessToken);
			await SecureStorage.setItem(REFRESH_KEY, tokens.refreshToken);
		},

		async clear(): Promise<void> {
			await Promise.all([
				SecureStorage.removeItem(ACCESS_KEY),
				SecureStorage.removeItem(REFRESH_KEY),
				SecureStorage.removeItem(USER_KEY)
			]);
		}
	};
}

/** The cached user blob, so the first frame after a cold start is local-first. */
export async function getStoredUser(): Promise<User | null> {
	try {
		const raw = await SecureStorage.getItem(USER_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as User;
	} catch {
		return null;
	}
}

export async function setStoredUser(user: User): Promise<void> {
	await SecureStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearStoredUser(): Promise<void> {
	await SecureStorage.removeItem(USER_KEY);
}
