# Railway Environment Variables

Paste these into each service's **Variables** tab on Railway.

---

## Backend service

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway auto-links — use this exact syntax |
| `NODE_ENV` | `production` | Required — enables prod guard |
| `ADMIN_TOKEN` | _(random 20+ char string)_ | **Required in prod** — e.g. `openssl rand -hex 16` |
| `CORS_ORIGIN` | `https://your-frontend.up.railway.app` | Paste your frontend URL after deploy |
| `YT_MODE` | `mock` | Start with mock; switch to `apikey` once live |
| `CHANNEL_NAME` | `Your Channel Name` | Shown in /api/stats |
| `SEED_DEMO` | `false` | Set `true` only to seed demo villagers on first boot |

### Optional — YouTube API key mode
| Variable | Value |
|---|---|
| `YT_MODE` | `apikey` |
| `YT_API_KEY` | _(your YouTube Data API v3 key)_ |
| `YT_CHANNEL_ID` | _(your channel ID, e.g. UCxxxxxx)_ |

---

## Frontend service

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.up.railway.app` | Paste your backend URL |
| `PORT` | `3000` | Railway sets this automatically, but explicit is safer |

---

## Notes
- Railway injects `PORT` automatically — `next start -p 3000` in package.json is fine.
- The backend already runs migrations on startup (`waitForDb` + `migrate()` in `index.ts`).
- After first deploy, check `/api/health` → should return `{"ok":true}`.
