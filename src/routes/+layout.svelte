<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { auth, restoreSession } from '$lib/auth/auth.svelte';

	let { children } = $props();

	let restoring = false;

	$effect(() => {
		if (restoring) return;
		restoring = true;
		void restoreSession();
	});

	$effect(() => {
		// Trailing slashes vary between `vite dev` and the Capacitor static shell.
		const path = page.url.pathname.replace(/\/+$/, '') || '/';
		if (auth.status === 'anon' && path !== '/login') {
			void goto(resolve('/login'));
		} else if (auth.status === 'authed' && path === '/login') {
			void goto(resolve('/'));
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if auth.status === 'unknown'}
	<div class="splash"></div>
{:else}
	{@render children()}
{/if}

<style>
	.splash {
		min-height: 100dvh;
		background: #0b0f1a;
	}
</style>
