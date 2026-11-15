# Jungle Village

Every YouTube subscriber becomes a villager in a growing pixel-art jungle. A new villager appears at the edge of the forest, walks to a tree, chops it down and builds a house next to other villagers. The camera zooms out as the village grows. Clicking a house shows the villager's random anime-character name and subscribe date. Houses upgrade with subscription age.

```
jungle-village/
  frontend/   Next.js 15 + React 19 + React Three Fiber (three.js) scene
  backend/    Express + TypeScript + pg, SSE, YouTube poller, migrations
  docker/     Postgres init scripts
  docker-compose.yml   Postgres 16
  .env.example
```

## Stack

| Part | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + React Three Fiber + three.js | React-driven scene; an orthographic camera gives a crisp top-down 2D view. Sprites are textured planes with `NearestFilter`. The forest is one big canvas texture, so 40k trees cost a single draw call. |
| Backend | Node + Express + `pg` (run with `tsx`) | Simple REST + Server-Sent Events. Bun is not installed here, but nothing is Node-specific. |
| DB | PostgreSQL 16 in Docker | Persists houses so the village looks identical for every visitor. |

The forest is generated **deterministically** from tile coordinates by `backend/src/shared.ts`, which the frontend imports as well. Only houses are stored in the database; the chopped trees and cleared yards are derived from them.

## Run it (development)

Requirements: Node 20+, Docker.

```bash
cp .env.example .env                     # edit if you like
docker compose up -d                     # Postgres on localhost:5433
cd backend && npm install && npm start   # runs migrations, seeds 14 demo villagers, API on :3001
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Copy `frontend/.env.local.example` to `frontend/.env.local` if the API is not on `http://localhost:3001`.

`npm run migrate` in `backend/` runs migrations alone (they also run automatically on start).

## Deploying for real

The recommended cheap, scalable setup (Cloudflare Pages for the website + one Hetzner VPS for the API and database, with Caddy HTTPS) is in **[DEPLOY.md](DEPLOY.md)**: step-by-step, including where every secret goes. The single-machine Docker stack below is for local production tests or any server with Docker.

## Production (one machine, all in Docker)

```bash
cp .env.example .env     # set ADMIN_TOKEN (`openssl rand -hex 24`), POSTGRES_PASSWORD, YT_* and CHANNEL_NAME; leave SEED_DEMO=false
docker compose --profile app up -d --build
# open http://localhost:8080  (HTTP_PORT)
```

This starts Postgres, the API (compiled TypeScript, non-root, read-only filesystem, health check), the Next.js site (standalone build) and an nginx front door that serves everything from one origin (`/` is the site, `/api` is the API, with unbuffered live events). Put TLS in front (Caddy, Cloudflare or a cloud load balancer) and keep Postgres private (`POSTGRES_BIND=127.0.0.1`, the default).

Hardening that is built in: the API refuses to start in production with a weak or missing `ADMIN_TOKEN`; admin routes use a constant-time token check and a stricter rate limit; every route is rate limited per IP; live connections are capped (total and per IP); request bodies are limited to 10 KB; security headers are set by the API, nginx and Next.js; the demo seed is off; debug hooks are compiled out; the process shuts down gracefully on SIGTERM; `/api/health` checks the database.

Operations notes: back up the `jungle_pgdata` volume (`pg_dump` is enough, the data is just subscribers); migrations run automatically on start; `docker compose logs -f backend` shows the poller (`GET /api/stats` shows its status and last error).

## Simulating subscribers

Open `http://localhost:3000/?admin=<ADMIN_TOKEN>` for a small Simulate panel (+1, +5, +20, +1 aged one year). Or use the API:

```bash
curl -X POST localhost:3001/api/admin/simulate -H "x-admin-token: change-me" -H "content-type: application/json" -d '{"count":3}'
curl -X POST localhost:3001/api/admin/simulate -H "x-admin-token: change-me" -H "content-type: application/json" -d '{"ageDays":400}'
curl -X DELETE "localhost:3001/api/admin/village?confirm=yes" -H "x-admin-token: change-me"   # wipe
```

## API

- `GET /api/village` returns the world info and all villagers (`name, subscribedAt, x, y, treeId, tier, ageDays`).
- `GET /api/stats` returns counts per tier and the poller status.
- `GET /api/events` is an SSE stream (`villager`, `reset`). Open browsers play the build animation live.
- `POST /api/admin/simulate` and `DELETE /api/admin/village` (header `x-admin-token`, checked when `ADMIN_TOKEN` is set).

## Scenery and performance

- **Biomes** (`biomeAt` in `backend/src/shared.ts`): emerald pine forest, blue taiga, golden maple grove, pink blossom grove and a lime flower meadow around the campfire. They have their own tree species, ground colours, flowers, mushrooms, ferns and reeds.
- **Waterfalls**: a rock cliff pouring into the pond, plus two river drops. The water is a scrolling texture with mist at the base. Fireflies drift over the village.
- **Chunked ground**: 64 canvas textures of 25x25 tiles. A new house re-uploads only the 1-4 chunks it touches, off-screen chunks are culled, and the world paints progressively (the 9 chunks around the fire first).
- **Instanced houses**: one draw call per tier, so thousands of houses stay cheap. Only the first 160 villagers wander around their houses. The renderer caps at 1.5x pixel ratio. 1,000+ villagers ran smoothly in testing.
- **Ten biomes**: emerald forest, blue taiga, golden grove, blossom grove and the lime meadow, plus climate zones: a mountain range (north-west corner) with snowfield beside it, desert (south-east, with the rocket launch complex), swamp with murky pools (south-west) and tropical jungle (north-east). Each has its own trees, ground, decorations and density.
- **Mountains and farmland**: the mountain biome is a dense range of 60+ hand-shaded peaks with pine foothills. Six fenced fields (wheat, sunflowers, pumpkins, lavender, cabbage, corn) with a barn, a spinning windmill, scarecrows, hay bales, farmers hoeing and dirt paths to the campfire. Houses never use these tiles.
- The browser pane must be visible when you test: a hidden pane pauses animation and looks like a blank canvas.

## Infinite worlds

Both worlds have no edge. Earth and the Moon are generated from tile coordinates by `backend/src/shared.ts` (the same code runs in the browser and on the server) and streamed in 25 x 25 tile chunks around the camera; chunks far away are freed. Earth is built from two climate fields (temperature and wetness) with warped borders, plus noise mountains, meandering rivers (contours of a noise field), lakes, and waterfalls where rivers climb into the mountains. The home village, farms and the launch complex are fixed near the start; everything else is wilderness in every direction.

The Moon has six biomes taken from other worlds: grey highlands, dark basalt mare, Mars rust dust, Europa ice with cracks, Io-style lava fields, and glowing crystal fields. Each has its own boulders, crystals, ice spires, vents, mesas or basalt columns.

Houses are spread out like real homesteads (at least 9 tiles apart) and form small hamlets. New houses grow a small hamlet first, sometimes grow a bigger one, and now and then found a brand-new hamlet in the least-populated biome, so people end up living in the desert, snow, swamp, jungle and mountains too (on the Moon: in every biome). In sparse biomes a house can go on open ground when there is no tree to chop. Zoom with the wheel, the + / - buttons or the + and - keys (0 resets); drag to pan.

## 2.5D look

The camera is orthographic but tilted (`TILT` in `frontend/src/components/common.tsx`). The ground is flat; trees (about 28k, one instanced draw call), mountain peaks, houses, props and villagers are upright camera-facing sprites standing on it, so the z-buffer sorts them properly (a villager walks behind a house, a tree hides a roof). Shadows fall to the south-east: soft ellipses under trees, long ones under peaks, blob shadows under villagers and houses. The ground has hill shading from a noise height field, and each tree gets one of four sizes. Biome zones have noise-warped outlines and mixed (ragged) borders, with thickets and glades in the tree density, instead of clean circles.

## Moon colony and rocket

A rocket launch complex (concrete pad, gantry, fuel tanks, control building) sits in the south-east desert. Click the rocket, or the "Fly to the Moon" button, for a lift-off animation and a trip to the Moon: a cratered lunar base with glass domes, a landing pad, solar arrays, a dish, a flag and a rover. Premium members and subscribers of **1 year or more** (`LUNAR_MIN_DAYS` in `backend/src/shared.ts`) live there, all in space suits. Click the Moon rocket to fly back. The whole trip is animated: lift-off with smoke and a following camera, a pixel-art space flight with the origin planet shrinking and the destination growing, then a landing on engines (re-entry glow and dust on Earth, a floaty low-gravity burn and dust blast on the Moon).

- Moon homes are chosen with the same cluster rule as Earth and stored in `subscribers.moon_x / moon_y` (migration `003_moon_premium.sql`). People who cross the one-year mark are moved automatically the next time the village is loaded.
- Everyone keeps their Earth house; colonists are also shown on the Moon.
- Premium is a flag (`subscribers.premium`). Set it with `POST /api/admin/premium {"id": 3}` or `POST /api/admin/simulate {"premium": true}`. The YouTube API cannot list channel members without the owner's OAuth and the memberships scope, so this is a manual flag for now.

## Clothes and houses by biome

Villagers dress for the biome their house is in (snow parkas with fur hoods, desert robes and turbans, swamp ponchos, tropical shirts and straw hats, mountain helmets and backpacks, blossom kimonos, and so on) and houses change materials and shape: snow-capped roofs, adobe flat roofs with awnings, stilt huts in the swamp and jungle, pink tiles, teal log cabins, slate chalets. Open `/gallery` to see every house style and outfit side by side.

## Rules implemented## Rules implemented

- **Community placement** (`backend/src/placement.ts`): a new house needs at least min(3, existing houses) neighbours within 8 tiles. It prefers sites with at most 5 neighbours, so the village grows as clusters of 3-5. Houses never touch (at least 4 tiles between centres), stay out of water and the campfire clearing, and go on a tree tile. Placement runs in a transaction under an advisory lock. If a tight cluster leaves no free tree tile, the neighbour requirement is relaxed step by step instead of failing.
- **Names**: random anime names from a built-in list, unique (DB `UNIQUE`). Roman-numeral suffixes are added once the list runs out.
- **Tiers** (from the subscribe date, recomputed in the browser every minute): hut `<90d`, wooden house `90d+`, cottage `1 year+`, manor `2 years+`.
- **Camera**: fits the village bounding box plus padding and eases in or out. Viewers can scroll to zoom (limited) and drag to pan. They cannot control characters.

## YouTube detection

Set `YT_MODE` in `.env`.

### `mock` (default)
No credentials. Use the simulate route above, or `MOCK_GROWTH_PROBABILITY=0.3` to have fake subscribers arrive on each poll.

### `apikey`: subscriber **count** polling
1. Go to <https://console.cloud.google.com/>, create a project, then **APIs & Services → Library → YouTube Data API v3 → Enable**.
2. **Credentials → Create credentials → API key**. Restrict it to the YouTube Data API v3 and put it in `YT_API_KEY`.
3. Channel ID: YouTube Studio → **Settings → Channel → Advanced settings**, or your channel page's **About → Share → Copy channel ID** (starts with `UC`). Put it in `YT_CHANNEL_ID`.
4. `YT_MODE=apikey`, `SEED_DEMO=false`. Optionally set `YT_BACKFILL_LIMIT` (see below).

Every `YT_POLL_INTERVAL_SEC` the backend calls `channels.list?part=statistics` and spawns (count − last known count) villagers. Cost is 1 quota unit per poll, against 10,000 per day.

**Limitations**
- The public API only exposes `subscriberCount`. It **does not expose who subscribed**, so names are random anime names and the subscribe date is the *detection time*.
- Counts are **rounded to 3 significant figures** for large channels (for example 12,345 shows as 12,300). Growth is only detected when the rounded number changes, in steps of 10, 100 and so on for big channels.
- Detection is polling, so it is delayed by up to the poll interval. YouTube offers no free push event for new subscribers.
- Unsubscribes lower the baseline and never remove villagers, so unsubscribing and re-subscribing adds a new villager.
- On the first poll the current count becomes the baseline. Existing subscribers have no known date and are not imported, except up to `YT_BACKFILL_LIMIT` villagers dated "now".

### `oauth`: real subscribe dates (optional, channel owner only)
`subscriptions.list?mySubscribers=true` returns subscribers with a real `publishedAt` date, but only those whose subscription list is public.
1. Same Cloud project: **OAuth consent screen** (External, add yourself as a test user), then **Credentials → OAuth client ID** (type *Web application*, redirect URI `https://developers.google.com/oauthplayground`). Put the id and secret in `YT_OAUTH_CLIENT_ID` and `YT_OAUTH_CLIENT_SECRET`.
2. Open <https://developers.google.com/oauthplayground>. In the ⚙ settings tick *Use your own OAuth credentials*. Authorize scope `https://www.googleapis.com/auth/youtube.readonly` with the channel owner's account, exchange the code, and copy the **refresh token** into `YT_OAUTH_REFRESH_TOKEN`.
3. `YT_MODE=oauth`. The first poll imports up to `YT_OAUTH_IMPORT_LIMIT` of the newest public subscribers with their real dates. After that, only unseen subscription ids spawn villagers. Private subscribers are invisible to this API.

Names stay random anime names in every mode. The subscriber's real YouTube name is never stored or shown.

## Connected channel

`.env` is preconfigured for **Old School Stories TV** (`https://www.youtube.com/@OldSchoolStoriesTV`, channel ID `UCFZLzGrnth6TDH_Xyh_McBQ`). To go live, add your API key and switch modes:

```
YT_MODE=apikey
YT_API_KEY=<your key>
SEED_DEMO=false
YT_BACKFILL_LIMIT=15   # first poll creates one villager per current subscriber (up to this limit)
```

Then wipe the demo data once (`DELETE /api/admin/village?confirm=yes`) and restart the backend. `GET /api/stats` shows the poller status and any error.

## Tests and CI

`cd backend && npm test` runs the world and placement tests: determinism, unique tile ids, every biome occurs, houses stay at least 9 tiles apart and end up in many biomes (including the desert) on Earth and the Moon, house tiers and Moon eligibility. `.github/workflows/ci.yml` runs typecheck, tests and builds for both apps, then builds the Docker images.

## Not in this build

`wip-globe-animals/` holds unfinished work that is **not** wired into the app: a whole-planet globe with real continents, deserts, forests and mountains, wildlife and farm animals, and sailing ships on oceans. It compiles but was never verified, so it was taken out of the build.

## Known gaps

- The apikey and oauth modes were not run against the real YouTube API (no credentials here); only mock mode and the simulate route were exercised.
- Sprites are procedural placeholders (`frontend/src/lib/art.ts`). Swap in real pixel-art sheets for the final look.
- No auth beyond the shared admin token. There is no production Docker setup for the app itself, only Postgres.
- `window.__forest`, `__scene`, `__cam` and `__zoom` are debug hooks; remove them for production.
