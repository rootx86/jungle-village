import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import { config } from './config.js';
import { migrate, waitForDb, pool } from './db.js';
import { bus, createVillager, listVillagers, placeColonists, resetVillage, seedDemo, setPremium, stats } from './service.js';
import { pollerStatus, startPoller } from './poller.js';
import { TILE, SEED, TIERS, LUNAR_MIN_DAYS, type SubscriberDTO } from './shared.js';

const log = {
  info: (m: unknown) => console.log(new Date().toISOString(), m),
  error: (m: unknown) => console.error(new Date().toISOString(), m),
};

// ---- production guard rails ------------------------------------------------------------------
if (config.isProd) {
  const weak = !config.adminToken || config.adminToken.length < 16 || config.adminToken === 'change-me';
  if (weak) { log.error('Refusing to start: set ADMIN_TOKEN to a random string of at least 16 characters.'); process.exit(1); }
  if (config.seedDemo) log.error('Warning: SEED_DEMO is on in production; demo villagers will be created.');
}

await waitForDb();
const applied = await migrate();
log.info(`migrations applied: ${applied.join(', ') || 'none (up to date)'}`);
if (config.seedDemo) await seedDemo();
const moved = await placeColonists();
if (moved) log.info(`${moved} villagers moved to the Moon colony`);

const world = { tile: TILE, seed: SEED, tiers: TIERS, lunarMinDays: LUNAR_MIN_DAYS };
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind nginx / a load balancer
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
});
const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'DELETE'],
  maxAge: 600,
}));
app.use(express.json({ limit: '10kb' }));

// tiny in-memory rate limiter (per IP); put a real WAF / CDN in front for serious traffic
const hits = new Map<string, { n: number; reset: number }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60_000).unref();
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/events') { next(); return; }
  const limit = req.path.startsWith('/admin') ? 30 : config.rateLimitPerMin, now = Date.now();
  const key = `${req.ip}|${req.path.startsWith('/admin') ? 'a' : 'p'}`;
  const h = hits.get(key) ?? { n: 0, reset: now + 60_000 };
  if (h.reset < now) { h.n = 0; h.reset = now + 60_000; }
  h.n++; hits.set(key, h);
  if (h.n > limit) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'rate limit exceeded' }); return; }
  next();
});

const wrap = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res) => { fn(req, res).catch((e) => { log.error(e); if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) }); }); };

app.get('/api/health', wrap(async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }); }));

// short, shared caching: a CDN in front absorbs traffic spikes (new villagers still arrive instantly over /api/events)
const cacheable = (res: express.Response) => res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=20, stale-while-revalidate=60');
app.get('/api/village', wrap(async (_req, res) => {
  cacheable(res);
  const subscribers = await listVillagers();
  res.json({ world, count: subscribers.length, subscribers });
}));

app.get('/api/stats', wrap(async (_req, res) => {
  cacheable(res);
  res.json({ ...(await stats()), channelName: config.channelName, poller: pollerStatus });
}));

// Server-Sent Events: every new villager is pushed to all open browsers.
let sseClients = 0;
const sseByIp = new Map<string, number>();
app.get('/api/events', (req, res) => {
  const ip = req.ip ?? '?';
  if (sseClients >= config.maxSseClients || (sseByIp.get(ip) ?? 0) >= 12) { res.status(503).json({ error: 'too many live connections' }); return; }
  sseClients++; sseByIp.set(ip, (sseByIp.get(ip) ?? 0) + 1);
  res.writeHead(200, {
    'x-accel-buffering': 'no',
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n');
  const onVillager = (v: SubscriberDTO) => res.write(`event: villager\ndata: ${JSON.stringify(v)}\n\n`);
  const onReset = () => res.write('event: reset\ndata: {}\n\n');
  bus.on('villager', onVillager);
  bus.on('reset', onReset);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping); bus.off('villager', onVillager); bus.off('reset', onReset);
    sseClients--; sseByIp.set(ip, Math.max(0, (sseByIp.get(ip) ?? 1) - 1));
  });
});

// ---- admin / debug --------------------------------------------------------
app.use('/api/admin', (req, res, next) => {
  const given = Buffer.from(req.header('x-admin-token') ?? '');
  const want = Buffer.from(config.adminToken);
  const ok = !config.adminToken || (given.length === want.length && timingSafeEqual(given, want));
  if (!ok) {
    res.status(401).json({ error: 'invalid or missing x-admin-token' });
    return;
  }
  next();
});

/** Simulate new subscribers: POST /api/admin/simulate {count?:1..50, ageDays?:number, subscribedAt?:ISO} */
app.post('/api/admin/simulate', wrap(async (req, res) => {
  const b = (req.body ?? {}) as { count?: number; ageDays?: number; subscribedAt?: string; premium?: boolean };
  const count = Math.max(1, Math.min(50, Math.floor(b.count ?? 1)));
  const when = b.subscribedAt ? new Date(b.subscribedAt)
    : b.ageDays !== undefined ? new Date(Date.now() - b.ageDays * 86_400_000) : undefined;
  if (when && Number.isNaN(when.getTime())) { res.status(400).json({ error: 'bad subscribedAt' }); return; }
  const created: SubscriberDTO[] = [];
  for (let i = 0; i < count; i++) created.push(await createVillager({ subscribedAt: when, premium: b.premium === true }));
  res.json({ created });
}));

/** Make a subscriber a premium member (moves them to the Moon): POST /api/admin/premium {id, premium?:boolean} */
app.post('/api/admin/premium', wrap(async (req, res) => {
  const b = (req.body ?? {}) as { id?: number; premium?: boolean };
  const dto = b.id ? await setPremium(b.id, b.premium !== false) : null;
  if (!dto) { res.status(404).json({ error: 'unknown subscriber id' }); return; }
  res.json(dto);
}));

/** Wipe the village (debug). Requires ?confirm=yes. */
app.delete('/api/admin/village', wrap(async (req, res) => {
  if (req.query.confirm !== 'yes') { res.status(400).json({ error: 'add ?confirm=yes' }); return; }
  await resetVillage();
  res.json({ ok: true });
}));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error(err);
  if (!res.headersSent) res.status(500).json({ error: 'internal error' });
});

const server = app.listen(config.port, () => log.info(`API listening on :${config.port} (yt mode: ${config.yt.mode})`));
startPoller(log);

const stop = async () => {
  log.info('shutting down');
  setTimeout(() => process.exit(1), 8000).unref();
  server.close();
  await pool.end().catch(() => undefined);
  process.exit(0);
};
process.on('unhandledRejection', (e) => log.error(e));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
