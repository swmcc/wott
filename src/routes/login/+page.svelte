<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError } from '$lib/api/client';
	import { login } from '$lib/auth/auth.svelte';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;

		busy = true;
		error = null;
		try {
			await login(email, password);
			await goto(resolve('/'));
		} catch (err) {
			error = err instanceof ApiError ? err.detail : 'Could not reach whatisonthe.tv. Try again.';
		} finally {
			busy = false;
		}
	}
</script>

<main>
	<h1>WOTT</h1>
	<p class="tagline">say “what”</p>

	<form {onsubmit}>
		<label for="email">Email</label>
		<input
			id="email"
			type="email"
			bind:value={email}
			autocomplete="email"
			autocapitalize="none"
			autocorrect="off"
			required
			disabled={busy}
		/>

		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			autocomplete="current-password"
			required
			disabled={busy}
		/>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
</main>

<style>
	main {
		min-height: 100dvh;
		display: grid;
		align-content: center;
		justify-items: stretch;
		gap: 0.25rem;
		padding: 1.5rem;
		max-width: 26rem;
		margin: 0 auto;
		background: #0b0f1a;
		color: #f3f4f6;
		font-family:
			ui-sans-serif,
			-apple-system,
			'Segoe UI',
			Helvetica,
			Arial,
			sans-serif;
	}
	h1 {
		font-size: 3rem;
		letter-spacing: 0.2em;
		margin: 0;
		text-align: center;
		color: #5eead4;
	}
	.tagline {
		margin: 0 0 2rem;
		text-align: center;
		color: #9ca3af;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		font-size: 0.8rem;
	}
	form {
		display: grid;
		gap: 0.4rem;
	}
	label {
		font-size: 0.75rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
		margin-top: 0.75rem;
	}
	input {
		font: inherit;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid #1f2937;
		background: #111827;
		color: #f3f4f6;
	}
	input:focus {
		outline: 2px solid #5eead4;
		outline-offset: 1px;
	}
	.error {
		margin: 0.75rem 0 0;
		color: #fca5a5;
		font-size: 0.9rem;
	}
	button {
		font: inherit;
		margin-top: 1.5rem;
		padding: 0.8rem;
		border: none;
		border-radius: 0.5rem;
		background: #5eead4;
		color: #0b0f1a;
		font-weight: 600;
		letter-spacing: 0.05em;
	}
	button:disabled {
		opacity: 0.6;
	}
</style>
