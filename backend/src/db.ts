import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function waitForDb(tries = 30): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function migrate(): Promise<string[]> {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      applied.push(f);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  return applied;
}

export async function getState<T = unknown>(key: string): Promise<T | null> {
  const r = await pool.query('SELECT value FROM village_state WHERE key=$1', [key]);
  return r.rows[0]?.value ?? null;
}
export async function setState(key: string, value: unknown): Promise<void> {
  await pool.query(
    'INSERT INTO village_state(key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
    [key, JSON.stringify(value)],
  );
}
