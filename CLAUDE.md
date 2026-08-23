# CLAUDE.md

WOTT (pronounced "what") — a native check-in companion app for
[whatisonthe.tv](https://whatisonthe.tv). iOS + Android via **Capacitor
wrapping a static SvelteKit build** (ADR-001). This repo is the mobile client
only; the backend lives in `swmcc/whatisonthe.tv` (locally at
`~/Code/whatisonthe.tv`).

## Read before working on any issue

1. **`PLAN.md`** — product principles, architecture, screens, SQLite schema,
   milestones. Every issue links to its section.
2. **`API.md`** — the backend contract: real endpoint shapes verified against
   the backend source, plus PROPOSED shapes for the M1 endpoints
   (continue-watching, refresh tokens, `client_uuid`). Build clients against
   API.md, not guesses. If an M1 shape changes, it changes in the
   whatisonthe.tv issue first, then API.md, then here.

## Ground rules (from PLAN.md — the short version)

- **Local-first:** first frame renders from SQLite; the network is never in
  front of a tap. Optimistic check-ins with a background sync queue.
- **IDs:** everything in SQLite is keyed by **TVDB id**. Never persist the
  server's internal `id` fields, except a check-in's own `server_id`.
- **Tokens** go in Capacitor Secure Storage, never localStorage (iOS evicts
  web storage).
- **The bar:** cold start → checked in to the next episode in under 3 seconds
  on mobile data.

## What agents can and can't verify

- Simulators/emulators, unit tests, `npm run build`: fair game.
- **Real-device steps (physical iPhone, cold-start stopwatch, TestFlight) are
  Stephen's** — stop at "works in simulator, ready for device test" and say
  so in the issue rather than claiming device criteria are met.

## Conventions

- Emoji-prefixed commit messages (e.g. `✨ Add sync queue`).
- Before pushing: tests + lint must pass (`npm test`, `npm run lint` once the
  scaffold defines them; see the Makefile when it exists).
- Issue workflow: branch → implement → tests/lint → rebase on `main` → PR.
