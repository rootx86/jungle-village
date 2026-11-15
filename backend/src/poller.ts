import { config } from './config.js';
import { pool, getState, setState } from './db.js';
import { createVillager } from './service.js';

type Log = { info: (m: string) => void; error: (m: unknown) => void };

export const pollerStatus = {
  mode: config.yt.mode as string,
  intervalSec: config.yt.mode === 'mock' ? config.yt.mockPollSec : config.yt.pollSec,
  lastPollAt: null as string | null,
  lastCount: null as number | null,
  knownCount: null as number | null,
  lastError: null as string | null,
};

const YT = 'https://www.googleapis.com/youtube/v3';

/** Spawns (count - known) villagers, then stores the new baseline. Used by mock + apikey modes. */
async function reconcileCount(count: number, log: Log): Promise<void> {
  pollerStatus.lastCount = count;
  const known = await getState<number>('known_count');
  if (known === null) {
    // First run: remember the channel's current size as baseline; optionally import a few villagers.
    const n = Math.min(config.yt.backfillLimit, count);
    for (let i = 0; i < n; i++) await createVillager({ youtubeChannelId: config.yt.channelId || undefined });
    await setState('known_count', count);
    pollerStatus.knownCount = count;
    log.info(`baseline subscriber count = ${count}; backfilled ${n} villagers`);
    return;
  }
  if (count < known) { // unsubscribes: we never remove villagers, just lower the baseline
    await setState('known_count', count);
    pollerStatus.knownCount = count;
    return;
  }
  const spawn = Math.min(count - known, config.yt.maxSpawnPerPoll);
  for (let i = 0; i < spawn; i++) await createVillager({ youtubeChannelId: config.yt.channelId || undefined });
  await setState('known_count', known + spawn);
  pollerStatus.knownCount = known + spawn;
  if (spawn) log.info(`+${spawn} new subscriber(s) detected (count ${count})`);
}

async function tickMock(log: Log) {
  let c = (await getState<number>('mock_count')) ?? 100;
  if (Math.random() < config.yt.mockGrowthProbability) c += 1 + Math.floor(Math.random() * 2);
  await setState('mock_count', c);
  await reconcileCount(c, log);
}

async function tickApiKey(log: Log) {
  const { apiKey, channelId } = config.yt;
  if (!apiKey || !channelId) throw new Error('YT_API_KEY and YT_CHANNEL_ID are required for YT_MODE=apikey');
  const res = await fetch(`${YT}/channels?part=statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const stats = json.items?.[0]?.statistics;
  if (!stats) throw new Error('Channel not found for YT_CHANNEL_ID');
  if (stats.hiddenSubscriberCount) throw new Error('Channel hides its subscriber count');
  await reconcileCount(Number(stats.subscriberCount), log);
}

async function accessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = config.yt;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('YT_OAUTH_* variables are required for YT_MODE=oauth');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error(`OAuth token refresh failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as any).access_token;
}

/** OAuth mode: subscriptions.list?mySubscribers=true -> real subscribe dates (public subscribers only). */
async function tickOAuth(log: Log) {
  const token = await accessToken();
  const items: Array<{ id: string; publishedAt: string }> = [];
  let pageToken = '';
  do {
    const url = `${YT}/subscriptions?part=snippet,subscriberSnippet&mySubscribers=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    for (const it of json.items ?? []) items.push({ id: it.id, publishedAt: it.snippet?.publishedAt });
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  pollerStatus.lastCount = items.length;

  const known = new Set((await pool.query('SELECT youtube_subscription_id AS id FROM subscribers WHERE youtube_subscription_id IS NOT NULL')).rows.map((r) => r.id));
  const fresh = items.filter((i) => !known.has(i.id)).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const first = (await getState('oauth_imported')) === null;
  const batch = first ? fresh.slice(-config.yt.oauthImportLimit) : fresh.slice(0, config.yt.maxSpawnPerPoll);
  for (const i of batch) {
    await createVillager({ subscribedAt: new Date(i.publishedAt), youtubeSubscriptionId: i.id, youtubeChannelId: config.yt.channelId || undefined });
  }
  if (first) await setState('oauth_imported', true);
  if (batch.length) log.info(`+${batch.length} subscriber(s) via OAuth`);
}

export function startPoller(log: Log): void {
  const tick = { mock: tickMock, apikey: tickApiKey, oauth: tickOAuth }[config.yt.mode];
  if (!tick) { log.error(`unknown YT_MODE ${config.yt.mode}`); return; }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await tick(log); pollerStatus.lastError = null; }
    catch (e: any) { pollerStatus.lastError = String(e?.message ?? e); log.error(e); }
    finally { pollerStatus.lastPollAt = new Date().toISOString(); running = false; }
  };
  log.info(`YouTube poller started: mode=${config.yt.mode}, every ${pollerStatus.intervalSec}s`);
  void run();
  setInterval(run, pollerStatus.intervalSec * 1000).unref();
}
