import { EventEmitter } from 'node:events';
import type pg from 'pg';
import { pool } from './db.js';
import { chooseSite, chooseMoonSite } from './placement.js';
import { pickName } from './names.js';
import { tierFor, ageDays, treeId, isColonist, type SubscriberDTO } from './shared.js';

export const bus = new EventEmitter();
bus.setMaxListeners(0);

interface Row {
  id: number; anime_name: string; subscribed_at: Date; house_x: number; house_y: number; tree_id: number;
  premium: boolean; moon_x: number | null; moon_y: number | null;
}
export const toDTO = (r: Row): SubscriberDTO => ({
  id: r.id,
  name: r.anime_name,
  subscribedAt: new Date(r.subscribed_at).toISOString(),
  x: r.house_x,
  y: r.house_y,
  treeId: r.tree_id,
  tier: tierFor(r.subscribed_at),
  ageDays: ageDays(r.subscribed_at),
  premium: r.premium,
  moon: r.moon_x === null || r.moon_y === null ? null : { x: r.moon_x, y: r.moon_y },
});

export async function listVillagers(): Promise<SubscriberDTO[]> {
  await placeColonists(); // anyone who became long-term since the last call moves to the Moon
  const r = await pool.query<Row>('SELECT * FROM subscribers ORDER BY id');
  return r.rows.map(toDTO);
}

export interface NewVillager {
  subscribedAt?: Date;
  premium?: boolean;
  youtubeSubscriptionId?: string;
  youtubeChannelId?: string;
  announce?: boolean; // emit the live SSE event (default true)
}

/** Places one colonist on the Moon (call inside a transaction that holds the placement lock). */
async function placeOnMoon(client: pg.PoolClient, id: number): Promise<void> {
  const moon = await client.query<{ moon_x: number; moon_y: number }>('SELECT moon_x, moon_y FROM subscribers WHERE moon_x IS NOT NULL');
  const site = chooseMoonSite(moon.rows.map((r) => ({ x: r.moon_x, y: r.moon_y })));
  await client.query('UPDATE subscribers SET moon_x=$1, moon_y=$2 WHERE id=$3', [site.x, site.y, id]);
}

/** Creates one villager: unique anime name + community-placed house, atomically. */
export async function createVillager(opts: NewVillager = {}): Promise<SubscriberDTO> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(424242)'); // serialise placement
    const existing = await client.query<Row>('SELECT * FROM subscribers');
    const houses = existing.rows.map((r) => ({ x: r.house_x, y: r.house_y }));
    const used = new Set(existing.rows.map((r) => r.anime_name));
    const site = chooseSite(houses);
    const name = pickName(used);
    const when = opts.subscribedAt ?? new Date();
    const premium = opts.premium ?? false;
    const ins = await client.query<Row>(
      `INSERT INTO subscribers (anime_name, subscribed_at, house_x, house_y, tree_id, youtube_channel_id, youtube_subscription_id, premium)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, when, site.x, site.y, treeId(site.x, site.y), opts.youtubeChannelId ?? null, opts.youtubeSubscriptionId ?? null, premium],
    );
    if (isColonist(premium, ageDays(when))) await placeOnMoon(client, ins.rows[0].id);
    const fresh = await client.query<Row>('SELECT * FROM subscribers WHERE id=$1', [ins.rows[0].id]);
    await client.query('COMMIT');
    const dto = toDTO(fresh.rows[0]);
    if (opts.announce !== false) bus.emit('villager', dto);
    return dto;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Moves every eligible subscriber (premium or long-term) that has no Moon home yet to the lunar colony. */
export async function placeColonists(): Promise<number> {
  const pending = await pool.query<Row>('SELECT * FROM subscribers WHERE moon_x IS NULL ORDER BY id');
  const todo = pending.rows.filter((r) => isColonist(r.premium, ageDays(r.subscribed_at)));
  if (!todo.length) return 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(424242)');
    for (const r of todo) await placeOnMoon(client, r.id);
    await client.query('COMMIT');
    return todo.length;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function setPremium(id: number, premium: boolean): Promise<SubscriberDTO | null> {
  const r = await pool.query<Row>('UPDATE subscribers SET premium=$1 WHERE id=$2 RETURNING *', [premium, id]);
  if (!r.rows.length) return null;
  await placeColonists();
  const fresh = await pool.query<Row>('SELECT * FROM subscribers WHERE id=$1', [id]);
  return toDTO(fresh.rows[0]);
}

export async function stats() {
  const all = await listVillagers();
  const byTier = { hut: 0, house: 0, cottage: 0, manor: 0 } as Record<string, number>;
  for (const v of all) byTier[v.tier]++;
  return { count: all.length, byTier, colonists: all.filter((v) => v.moon).length, newest: all.length ? all[all.length - 1] : null };
}

export async function resetVillage(): Promise<void> {
  await pool.query('TRUNCATE subscribers RESTART IDENTITY');
  await pool.query("DELETE FROM village_state WHERE key IN ('known_count','mock_count')");
  bus.emit('reset');
}

/** Demo villagers of every age so all house tiers (and the Moon colony) are visible on first run. */
export async function seedDemo(): Promise<void> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM subscribers');
  if (rows[0].n > 0) return;
  const ages = [820, 780, 520, 450, 400, 330, 260, 210, 150, 110, 70, 40, 12, 3];
  for (const d of ages) {
    await createVillager({ subscribedAt: new Date(Date.now() - d * 86_400_000), premium: d === 12, announce: false });
  }
}
