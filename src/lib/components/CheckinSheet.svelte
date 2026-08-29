<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { api } from '$lib/auth/auth.svelte';
	import { createCheckin, episodeCode, type ContinueWatchingItem } from '$lib/api/checkins';

	interface Props {
		item: ContinueWatchingItem;
		onclose: () => void;
		ondone: () => void;
	}

	let { item, onclose, ondone }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function checkIn() {
		if (busy) return;
		busy = true;
		error = null;
		try {
			await createCheckin(api, {
				content_id: item.content.tvdb_id,
				content_type: item.content.content_type,
				episode_id: item.next_episode?.tvdb_id ?? null,
				watched_at: new Date().toISOString()
			});
			ondone();
		} catch (err) {
			error = err instanceof ApiError ? err.detail : 'Could not reach the server. Try again.';
			busy = false;
		}
	}
</script>

<div
	class="scrim"
	onclick={onclose}
	onkeydown={(e) => e.key === 'Escape' && onclose()}
	role="presentation"
></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label="Check in">
	<header>
		<span class="show">{item.content.name}</span>
		{#if item.next_episode}
			<span class="episode">
				{episodeCode(item.next_episode)}
				{#if item.next_episode.name}
					· {item.next_episode.name}
				{/if}
			</span>
		{/if}
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button class="primary" onclick={checkIn} disabled={busy}>
		{busy ? 'Checking in…' : 'Check in'}
	</button>

	<!-- Optional extras (location, watched with, notes, focus) land in M6 behind
	     a "more" expander — the fast path stays one tap. -->
	<button class="ghost" onclick={onclose} disabled={busy}>Cancel</button>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 55%);
		z-index: 10;
	}
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 11;
		background: #111827;
		border-radius: 1rem 1rem 0 0;
		padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
		display: grid;
		gap: 0.9rem;
		box-shadow: 0 -8px 32px rgb(0 0 0 / 45%);
	}
	header {
		display: grid;
		gap: 0.2rem;
	}
	.show {
		font-weight: 700;
		font-size: 1.15rem;
	}
	.episode {
		color: #9ca3af;
		font-size: 0.9rem;
	}
	.error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.9rem;
	}
	button {
		font: inherit;
		padding: 0.85rem;
		border: none;
		border-radius: 0.6rem;
		font-weight: 600;
	}
	.primary {
		background: #5eead4;
		color: #0b0f1a;
		letter-spacing: 0.03em;
	}
	.ghost {
		background: transparent;
		color: #9ca3af;
	}
	button:disabled {
		opacity: 0.6;
	}
</style>
