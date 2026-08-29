import { describe, expect, it } from 'vitest';
import { createMemoryTokenStore } from './token-store';

describe('createMemoryTokenStore', () => {
	it('starts empty', async () => {
		await expect(createMemoryTokenStore().getTokens()).resolves.toBeNull();
	});

	it('round-trips a token pair', async () => {
		const store = createMemoryTokenStore();
		await store.setTokens({ accessToken: 'a', refreshToken: 'r' });

		await expect(store.getTokens()).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
	});

	it('replaces the pair on a rotation', async () => {
		const store = createMemoryTokenStore();
		await store.setTokens({ accessToken: 'a1', refreshToken: 'r1' });
		await store.setTokens({ accessToken: 'a2', refreshToken: 'r2' });

		await expect(store.getTokens()).resolves.toEqual({ accessToken: 'a2', refreshToken: 'r2' });
	});

	it('copies on write so callers cannot mutate stored tokens', async () => {
		const store = createMemoryTokenStore();
		const tokens = { accessToken: 'a', refreshToken: 'r' };
		await store.setTokens(tokens);
		tokens.accessToken = 'tampered';

		await expect(store.getTokens()).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
	});

	it('forgets everything on clear', async () => {
		const store = createMemoryTokenStore();
		await store.setTokens({ accessToken: 'a', refreshToken: 'r' });
		await store.clear();

		await expect(store.getTokens()).resolves.toBeNull();
	});
});
