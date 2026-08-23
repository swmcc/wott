import { describe, expect, it } from 'vitest';
import { appName } from './app';

describe('app', () => {
	it('has the right name', () => {
		expect(appName).toBe('WOTT');
	});
});
