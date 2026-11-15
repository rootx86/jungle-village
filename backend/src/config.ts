import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const env = process.env;
const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v: string | undefined, d: boolean) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(v.toLowerCase()));

const isProd = env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: num(env.BACKEND_PORT, 3001),
  databaseUrl: env.DATABASE_URL ?? 'postgres://jungle:jungle@localhost:5433/jungle',
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:3000',
  adminToken: env.ADMIN_TOKEN ?? '',
  seedDemo: bool(env.SEED_DEMO, !isProd), // demo villagers are for development only
  rateLimitPerMin: num(env.RATE_LIMIT_PER_MIN, 240),
  maxSseClients: num(env.MAX_SSE_CLIENTS, 2000),
  channelName: env.CHANNEL_NAME ?? 'My Channel',
  yt: {
    mode: (env.YT_MODE ?? 'mock') as 'mock' | 'apikey' | 'oauth',
    apiKey: env.YT_API_KEY ?? '',
    channelId: env.YT_CHANNEL_ID ?? '',
    pollSec: num(env.YT_POLL_INTERVAL_SEC, 300),
    backfillLimit: num(env.YT_BACKFILL_LIMIT, 0),
    maxSpawnPerPoll: num(env.YT_MAX_SPAWN_PER_POLL, 50),
    oauthImportLimit: num(env.YT_OAUTH_IMPORT_LIMIT, 100),
    clientId: env.YT_OAUTH_CLIENT_ID ?? '',
    clientSecret: env.YT_OAUTH_CLIENT_SECRET ?? '',
    refreshToken: env.YT_OAUTH_REFRESH_TOKEN ?? '',
    mockGrowthProbability: num(env.MOCK_GROWTH_PROBABILITY, 0),
    mockPollSec: num(env.MOCK_POLL_INTERVAL_SEC, 10),
  },
};
