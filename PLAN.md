# WOTT — Plan

_WOTT (pronounced "what") — a native check-in app for iOS and Android. Companion to [whatisonthe.tv](https://whatisonthe.tv); this repo holds the mobile client only._

**Status:** planning · **Last updated:** 2026-08-23

---

## 1. Problem

Check-ins get skipped because doing them on a phone via the website is too slow.
Every open is: launch browser view → hydrate SvelteKit → round-trip to Heroku →
maybe a TVDB fallback → _then_ tap. A PWA doesn't fix this on iOS: service
workers and storage get evicted, so it regularly cold-starts as a fresh website.

**The bar:** open the app and check in to the next episode of a current show in
under 3 seconds, on mobile data, every time.

## 2. Product principles

- **Remote control, not telly guide.** The app does check-ins. The website keeps
  watchlists, person pages, public profiles, stats, settings.
- **Local-first.** The first frame renders from on-device data. The network is
  never in front of a tap.
- **Optimistic writes.** A check-in is "done" the instant it's tapped; syncing
  to the backend happens in the background with retry.
- **Two speed tiers, honestly.** Anything previously watched is instant (tier 1).
  Searching for a _new_ show is a network call and may show a spinner (tier 2) —
  but once checked in, a show's seasons/episodes are pulled local and it joins
  tier 1 forever.

## 3. Framework decision (ADR-001)

**Decision: Capacitor wrapping a static SvelteKit build.**

**Why:**

- Stays in the existing stack (Svelte/TypeScript) — no new framework to learn
  and maintain for a personal app that is a list plus a form.
- Assets ship inside the binary → instant cold start, unlike a PWA.
- Stable local storage (SQLite) and secure token storage — iOS can't evict it.
- Real store presence on both platforms from one codebase.
- WebView rendering is easily sufficient for this UI surface.

**Rejected for now:**

- _Expo/React Native_ — better native headroom (home-screen widgets, watch app,
  Siri shortcuts) but costs learning and maintaining React.
- _Separate Swift + Kotlin apps_ — double maintenance, solo project.
- _PWA_ — lived experience says no; iOS eviction makes "fast" unachievable.

**Revisit triggers:** wanting home-screen widgets / a watch complication /
Siri "check in" shortcuts; or WebView performance disappointing on a real
device at milestone M3. If triggered, the local-first architecture, backend
work, and screens all carry over — only the shell changes.

## 4. Architecture

```
┌─────────────────────────── device ───────────────────────────┐
│  Capacitor shell (iOS / Android)                             │
│  ├── SvelteKit static build (bundled, no server)             │
│  ├── SQLite: shows, episodes, checkins, sync queue           │
│  ├── Secure storage: auth tokens                             │
│  └── Sync engine:                                            │
│       • launch → render from SQLite immediately              │
│       • background: refresh continue-watching + history      │
│       • queue: pending check-ins, flush with retry           │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS (JSON, JWT bearer)
                 whatisonthe.tv FastAPI backend (Heroku)
                               │
                          TVDB API (search / new content)
```

- **Frontend:** SvelteKit with `adapter-static` (SPA mode), bundled into the
  Capacitor shell. No SSR — the API is the only server.
- **Local store:** SQLite via `@capacitor-community/sqlite`. Mirrors just what
  tier 1 needs (see §6), not the whole catalogue.
- **Auth:** login once; tokens in Capacitor Secure Storage; silent refresh.
- **Sync rules:** server wins for content metadata; client wins for the user's
  own check-ins; pending queue flushes oldest-first on connectivity/foreground.

## 5. Screens (v1)

1. **Home** — continue-watching cards, one tap = check in to next episode;
   recent check-ins below. Renders from SQLite in the first frame; background
   refresh reconciles. A just-tapped check-in appears instantly (optimistic).
2. **Search** — text search → results (network, spinner OK) → Show screen.
3. **Show** — series: season/episode picker with watched markers; movie:
   straight to check-in. First check-in on a new show triggers local pull of
   its seasons/episodes.
4. **Check-in sheet** — one-tap fast path; optional fields (location, watched
   with, notes, focus — already in the schema) behind a "more" expander.
5. **History** — check-in feed grouped by day, local, infinite scroll via
   existing `days`/`before_date` params.
6. **Login** — email + password, once. Refresh keeps the session alive forever.

**Explicitly not in v1:** watchlists, person pages, public profiles, stats,
settings, push notifications, widgets, iPad layout.

## 6. Local data schema (SQLite)

| Table               | Contents                                                                                                   | Source of truth                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `shows`             | tvdb_id, name, year, image, type, last_synced                                                              | server                          |
| `episodes`          | tvdb_id, show tvdb_id, season, number, name, aired                                                         | server                          |
| `checkins`          | client_uuid, server_id?, content/episode ids, watched_at, extras, sync_state (`pending`/`synced`/`failed`) | client for own writes           |
| `continue_watching` | show tvdb_id, next episode tvdb_id, position                                                               | server, refreshed in background |
| `meta`              | schema version, last sync timestamps, current user                                                         | —                               |

`client_uuid` is generated on-device per check-in and sent to the API — it's
what makes retries safe (§7.3).

## 7. Backend changes (in the whatisonthe.tv repo)

Small, and all valuable to the website too:

1. **`GET /checkins/continue-watching`** — recent series with next-unwatched
   episode (and recently watched movies?). Powers Home in one call. Currently
   a client would have to stitch this from check-ins + episode lists.
2. **Refresh tokens.** Access token is 7-day with no refresh
   (`app/core/config.py:45`) — a weekly silent logout kills the habit. Add
   long-lived refresh + short-lived access, or long-lived device tokens
   (defensible for a personal app).
3. **Idempotent check-ins.** Add nullable `client_uuid` (unique) to `checkins`;
   `POST /checkins` upserts on it. A retrying sync queue must never create
   duplicates.
4. **CORS/origin config** for the Capacitor scheme
   (`capacitor://localhost` / `https://localhost` on Android).

## 8. Milestones

| #   | Milestone                                                                                                                                                      | Proves                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| M0  | Scaffold: SvelteKit static + Capacitor, runs on a real iPhone + Android device/emulator                                                                        | toolchain works                         |
| M1  | Backend: continue-watching endpoint, refresh tokens, `client_uuid` idempotency, CORS                                                                           | API ready (ships independently)         |
| M2  | Walking skeleton: login → Home fetches continue-watching from API → tap → check-in lands in prod DB                                                            | end-to-end, still network-bound         |
| M3  | Local-first: SQLite store, first-frame render from local, background refresh. **Measure cold start on device — this is the Capacitor go/no-go gate (ADR-001)** | "instant" is real                       |
| M4  | Sync queue: optimistic check-ins, offline tolerance, retry, idempotent flush                                                                                   | check in in a dead spot, it syncs later |
| M5  | Search + new-show flow, season/episode picker, local pull on first check-in                                                                                    | full experience                         |
| M6  | Polish: app icons, splash, haptics, dark mode, check-in extras sheet                                                                                           | feels like an app                       |
| M7  | Distribution: TestFlight + Android internal track (needs Apple Developer, $99/yr; Google Play, $25 once)                                                       | on your phone properly                  |

Order matters: M1 is pure whatisonthe.tv work and can ship first; M3 is the
gate where the framework decision gets validated against a stopwatch.

## 9. Open questions

- **Distribution** — full store release, or TestFlight/internal-track only?
  (Personal-use app doesn't need public listing; TestFlight is fine long-term.)
- **Android priority** — build/test iOS-first and let Android trail, or keep
  both green from M0?
- **Movies in continue-watching** — recently-watched movies on Home, or
  series-only?

## 10. From plan to issues

When this plan settles, each milestone becomes a GitHub milestone; §7 items
become issues on `whatisonthe.tv`; everything else becomes issues here.
