<script lang="ts">
	import { api, auth, logout } from '$lib/auth/auth.svelte';
	import {
		episodeCode,
		getContinueWatching,
		groupByDay,
		listRecentCheckins,
		type Checkin,
		type ContinueWatchingItem
	} from '$lib/api/checkins';
	import CheckinSheet from '$lib/components/CheckinSheet.svelte';

	// Network-bound v1 (M2): both lists come straight from the API on every
	// visit. M3 flips this to first-frame-from-SQLite with background refresh.
	let items = $state<ContinueWatchingItem[] | null>(null);
	let recent = $state<Checkin[] | null>(null);
	let error = $state<string | null>(null);
	let selected = $state<ContinueWatchingItem | null>(null);
	let justChecked = $state<string | null>(null);

	async function load() {
		error = null;
		try {
			const [cw, checkins] = await Promise.all([
				getContinueWatching(api),
				listRecentCheckins(api, 10)
			]);
			items = cw.items;
			recent = checkins;
		} catch {
			error = 'Could not load your shows. Pull yourself together, network.';
		}
	}

	$effect(() => {
		if (auth.status === 'authed' && items === null && error === null) void load();
	});

	function ondone() {
		const name = selected?.content.name ?? null;
		selected = null;
		justChecked = name;
		setTimeout(() => (justChecked = null), 2500);
		items = null;
		recent = null;
		void load();
	}

	const dayLabel = (day: string) => {
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 86_400_000).toDateString();
		return day === today ? 'Today' : day === yesterday ? 'Yesterday' : day;
	};
</script>

<main>
	<header class="top">
		<h1>WOTT</h1>
		<button class="link" onclick={() => void logout()}>Sign out</button>
	</header>

	{#if justChecked}
		<p class="toast" role="status">✓ Checked in to {justChecked}</p>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
		<button class="retry" onclick={() => void load()}>Retry</button>
	{:else if items === null}
		<p class="muted">Loading…</p>
	{:else}
		<section aria-label="Continue watching">
			<h2>Continue watching</h2>
			{#if items.length === 0}
				<p class="muted">Nothing on the go — check in to a show on whatisonthe.tv.</p>
			{:else}
				<ul class="cards">
					{#each items as item (item.content.tvdb_id)}
						<li>
							<button class="card" onclick={() => (selected = item)}>
								{#if item.content.image_url}
									<img src={item.content.image_url} alt="" loading="lazy" />
								{:else}
									<div class="placeholder"></div>
								{/if}
								<span class="name">{item.content.name}</span>
								{#if item.next_episode}
									<span class="next">
										{episodeCode(item.next_episode)}
										{#if item.next_episode.name}
											· {item.next_episode.name}
										{/if}
									</span>
									<span class="progress">
										{item.watched_episodes}/{item.total_episodes} watched
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section aria-label="Recent check-ins">
			<h2>Recent</h2>
			{#if recent === null || recent.length === 0}
				<p class="muted">No check-ins yet.</p>
			{:else}
				{#each groupByDay(recent) as group (group.day)}
					<h3>{dayLabel(group.day)}</h3>
					<ul class="recent">
						{#each group.checkins as c (c.id)}
							<li>
								<span class="what">
									{c.content.name}{#if c.episode}
										&nbsp;<span class="ep">{episodeCode(c.episode)}</span>
									{/if}
								</span>
								<span class="when">
									{new Date(c.watched_at).toLocaleTimeString([], {
										hour: '2-digit',
										minute: '2-digit'
									})}
								</span>
							</li>
						{/each}
					</ul>
				{/each}
			{/if}
		</section>
	{/if}
</main>

{#if selected}
	<CheckinSheet item={selected} onclose={() => (selected = null)} {ondone} />
{/if}

<style>
	main {
		min-height: 100dvh;
		padding: 1rem 1rem calc(2rem + env(safe-area-inset-bottom));
		max-width: 40rem;
		margin: 0 auto;
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	h1 {
		font-size: 1.4rem;
		letter-spacing: 0.2em;
		color: #5eead4;
		margin: 0;
	}
	.link {
		background: none;
		border: none;
		color: #9ca3af;
		font: inherit;
		font-size: 0.85rem;
		padding: 0;
	}
	h2 {
		font-size: 0.8rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: #9ca3af;
		margin: 1.5rem 0 0.75rem;
	}
	h3 {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 1rem 0 0.4rem;
		font-weight: 600;
	}
	.toast {
		background: #064e3b;
		color: #6ee7b7;
		padding: 0.6rem 0.9rem;
		border-radius: 0.5rem;
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
	}
	.error {
		color: #fca5a5;
	}
	.retry {
		font: inherit;
		background: #1f2937;
		color: #f3f4f6;
		border: none;
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
	}
	.muted {
		color: #6b7280;
		font-size: 0.9rem;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.75rem;
	}
	.card {
		display: grid;
		gap: 0.3rem;
		width: 100%;
		text-align: left;
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 0.75rem;
		padding: 0.6rem;
		color: inherit;
		font: inherit;
	}
	.card:active {
		border-color: #5eead4;
	}
	.card img,
	.placeholder {
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border-radius: 0.5rem;
		background: #1f2937;
	}
	.name {
		font-weight: 600;
		font-size: 0.95rem;
	}
	.next {
		color: #5eead4;
		font-size: 0.8rem;
	}
	.progress {
		color: #6b7280;
		font-size: 0.75rem;
	}
	.recent {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.recent li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		background: #111827;
		border-radius: 0.5rem;
		padding: 0.55rem 0.75rem;
		font-size: 0.9rem;
	}
	.ep {
		color: #5eead4;
	}
	.when {
		color: #6b7280;
		white-space: nowrap;
	}
</style>
