<script lang="ts">
	import { appName } from '$lib/app';
</script>

<main>
	<h1>{appName}</h1>
	<p>say “what”</p>
	<p class="hint">M0 scaffold — screens arrive in M2.</p>
</main>

<style>
	:global(body) {
		margin: 0;
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
	main {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 0.25rem;
	}
	h1 {
		font-size: 3rem;
		letter-spacing: 0.2em;
		margin: 0;
		color: #5eead4;
	}
	p {
		margin: 0;
		color: #9ca3af;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		font-size: 0.8rem;
	}
	.hint {
		margin-top: 1.5rem;
		letter-spacing: normal;
		text-transform: none;
	}
</style>
