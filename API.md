# WOTT ↔ whatisonthe.tv API Contract

*What the mobile app calls, verified against the backend source
(`swmcc/whatisonthe.tv`, `backend/app/`). Live interactive docs:
`https://whatisonthe.tv/docs` (FastAPI OpenAPI). Sections marked **PROPOSED**
are M1 backend work that doesn't exist yet — see the linked issues.*

**Last verified against backend source:** 2026-08-23

---

## Base URLs

| Environment | Base | Notes |
|---|---|---|
| Production | `https://whatisonthe.tv/api` | Heroku; same app serves website + API |
| Local dev | `http://localhost:8000/api` | `uvicorn` default; backend repo at `~/Code/whatisonthe.tv/backend` |

All endpoints below are relative to the base (i.e. `/auth/login` means
`https://whatisonthe.tv/api/auth/login`). Errors come back as FastAPI-standard
`{"detail": "message"}` with appropriate status codes.

## ID semantics — read this first

**Requests use TVDB IDs; responses contain both TVDB and internal DB IDs.**

- `POST /checkins` takes `content_id` and `episode_id` as **TVDB IDs**.
- Response objects (`content`, `episode`) have both `id` (internal Postgres
  PK — ignore it) and `tvdb_id`.
- The app's SQLite store keys everything by **tvdb_id** (per PLAN.md §6);
  never persist internal `id`s except `checkins.server_id` (the check-in's
  own `id`, needed for PATCH/DELETE).

## Auth

### `POST /auth/login`

```json
// request
{ "email": "a@b.com", "password": "..." }
// response 200
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": { "id": 1, "email": "a@b.com", "username": "stephen",
            "first_name": "…", "last_name": "…",
            "created_at": "…", "updated_at": "…" }
}
```

401 with `{"detail": "Incorrect email or password"}` on bad credentials.

- JWT, HS256, `sub` = user id (string). Currently expires after **7 days**
  with no refresh (`backend/app/core/config.py` →
  `access_token_expire_minutes`). Refresh tokens are M1 work — see PROPOSED
  below and [whatisonthe.tv#17](https://github.com/swmcc/whatisonthe.tv/issues/17).
- Send as `Authorization: Bearer <token>` on every authenticated call.
- Store in **Capacitor Secure Storage**, never localStorage.
- `GET /auth/me` → the `user` object above; useful as a token-validity probe.
- `POST /auth/logout` exists but is a no-op server-side; logout = delete the
  stored token.

### PROPOSED — refresh tokens ([whatisonthe.tv#17](https://github.com/swmcc/whatisonthe.tv/issues/17))

Shape to build against (may be adjusted in that issue — check it before
implementing the client side):

```json
// POST /auth/login response gains:
{ "access_token": "…", "refresh_token": "…", "token_type": "bearer", "user": {…} }
// POST /auth/refresh
// request:  { "refresh_token": "…" }
// response: { "access_token": "…", "refresh_token": "…" }  // rotating
```

Client behaviour: on any 401, try one refresh, retry the original request,
and only surface the login screen if the refresh itself 401s.

## Check-ins

### `POST /checkins` → 201

```json
// request — content_id/episode_id are TVDB IDs
{
  "content_id": 431162,
  "episode_id": 9187556,          // omit/null for movies
  "watched_at": "2026-08-23T21:14:00Z",   // required, ISO 8601
  "location": null,               // optional, ≤255 chars
  "watched_with": null,           // optional, ≤255 chars
  "notes": null,                  // optional
  "focus": null                   // optional: focused|distracted|background|sleep
}
// response 201
{
  "id": 4102, "user_id": 1,
  "content_id": 431162, "episode_id": 9187556,
  "watched_at": "…", "location": null, "watched_with": null,
  "notes": null, "focus": null,
  "content": { "id": 87, "tvdb_id": 431162, "name": "…",
               "content_type": "series", "year": 2023,
               "poster_url": null, "image_url": "…" },
  "episode": { "id": 3011, "tvdb_id": 9187556, "name": "…",
               "season_number": 2, "episode_number": 5, "image_url": null },
  "created_at": "…", "updated_at": "…"
}
```

Behaviour worth knowing:

- If the content isn't in the server DB yet, the server fetches it from TVDB,
  creates a basic record, and queues a full background sync (seasons,
  episodes, credits). So the **first** check-in on a brand-new show can be
  slow (TVDB round-trip) — that's the tier-2 path, spinner OK.
- 404 if `episode_id` isn't in the server DB yet ("Please ensure the series
  and its episodes are loaded") — can happen while the background sync is
  still running on a brand-new series. Treat as retryable.
- **Not yet idempotent.** `client_uuid` upsert is M1 work —
  [whatisonthe.tv#18](https://github.com/swmcc/whatisonthe.tv/issues/18).
  PROPOSED shape: request gains optional `"client_uuid": "<uuid4>"`; posting
  the same `client_uuid` twice returns the existing check-in (200) instead of
  creating a duplicate; response echoes `client_uuid`. The sync queue (wott
  #11/#12) must send it on every POST.

### `GET /checkins?days=10&before_date=<ISO>` — history

Returns a **flat array** of `CheckinResponse` (shape above), newest first,
covering the `days` most recent *distinct days* that have check-ins (not
calendar days). Day-grouping happens client-side. Infinite scroll: pass the
oldest `watched_at` you have as `before_date`, use `days=3` for pages
(website convention).

### Others

- `GET /checkins/content/{tvdb_id}` → flat array of the user's check-ins for
  one show/movie — this is how the Show screen gets **watched markers**.
  Returns `[]` (not 404) for unknown content.
- `GET /checkins/{id}` / `PATCH /checkins/{id}` / `DELETE /checkins/{id}` → 204.
  PATCH accepts any subset of `watched_at`, `location`, `watched_with`,
  `notes`, `focus`.

### PROPOSED — `GET /checkins/continue-watching` ([whatisonthe.tv#16](https://github.com/swmcc/whatisonthe.tv/issues/16))

Powers the Home screen in one call. **This is the agreed contract — both
sides build to this.** If it must change, change it in whatisonthe.tv#16
first, then update this file and wott#5.

```json
// response 200
{
  "items": [
    {
      "content": { "tvdb_id": 431162, "name": "Slow Horses",
                   "content_type": "series", "year": 2022, "image_url": "…" },
      "next_episode": { "tvdb_id": 9187556, "name": "…",
                        "season_number": 2, "episode_number": 5,
                        "aired": "2026-01-12", "runtime": 45,
                        "image_url": null },
      "last_watched_at": "2026-08-20T21:14:00Z",
      "watched_episodes": 12,
      "total_episodes": 20
    }
  ],
  "generated_at": "2026-08-23T10:00:00Z"
}
```

- Ordered by `last_watched_at` desc; sensible cap (~20 items).
- Series only for v1 (PLAN.md §9 open question). The shape supports movies
  later: `content_type: "movie"` with `next_episode: null`.
- A fully-watched series (no next unwatched episode) is omitted.
- `next_episode` = lowest (season, episode) the user has no check-in for,
  ignoring season 0 specials.

## Search & content (tier 2 — network, spinner OK)

- `GET /search?q=<query>&limit=20&offset=0` →
  `{ "query", "results": [...], "count", "offset", "has_more" }`.
  Each result: `{ id, name, type, overview, year, image_url, poster,
  primary_language, country, status }` — `id` is the **TVDB ID**, `type` is
  `"series"` or `"movie"`, `year` is a **string** here (int elsewhere).
- `GET /series/{tvdb_id}` / `GET /movie/{tvdb_id}` — detail objects
  (DB-first cache, TVDB fallback; shape is loose — see `/docs`).
- `GET /series/{tvdb_id}/seasons` → `{ "seasons": [...], "count" }`
- `GET /series/{tvdb_id}/episodes` → `{ "episodes": [...], "count" }` —
  **this is the local-pull source** for wott#15. Episode objects carry at
  least `tvdb_id`, `season_number`, `episode_number`, `name`, `aired`,
  `runtime`, `image_url` (mirrors `backend/app/models/episode.py`).
- `GET /series/{tvdb_id}/season/{n}/episodes` → same, filtered.

## CORS

Origins come from the comma-separated `CORS_ORIGINS` env var
(`backend/app/core/config.py`). The Capacitor WebView origins —
`capacitor://localhost` (iOS) and `https://localhost` (Android) — must be
added on Heroku: [whatisonthe.tv#19](https://github.com/swmcc/whatisonthe.tv/issues/19).
Until that ships, test against a local backend with the origins in `.env`.
