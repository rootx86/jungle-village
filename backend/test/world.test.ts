import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseSite, chooseMoonSite, EARTH, MOON, MIN_DIST } from '../src/placement.js';
import {
  biomeAt, treeAt, treeId, moonBiomeAt, isColonist, tierFor, ageDays, isBlocked, moonBlocked, yardTiles, TIERS, BIOMES, MOON_BIOMES,
} from '../src/shared.js';

const spread = (hs: Array<{ x: number; y: number }>) => {
  let min = Infinity;
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) min = Math.min(min, Math.max(Math.abs(hs[i].x - hs[j].x), Math.abs(hs[i].y - hs[j].y)));
  return min;
};

test('the worlds are deterministic (same tile, same answer)', () => {
  for (const [x, y] of [[0, 0], [100, 100], [-350, 920], [4000, -2500], [-12000, 9000]]) {
    assert.equal(biomeAt(x, y), biomeAt(x, y));
    assert.equal(treeAt(x, y), treeAt(x, y));
    assert.equal(moonBiomeAt(x, y), moonBiomeAt(x, y));
  }
});

test('tile ids are unique, fit a Postgres INTEGER and support negative coordinates', () => {
  const seen = new Set<number>();
  for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) {
    const id = treeId(x, y);
    assert.ok(Number.isInteger(id) && id > 0 && id < 2 ** 31, `id ${id} out of range`);
    assert.ok(!seen.has(id), `duplicate id for ${x},${y}`);
    seen.add(id);
  }
  assert.ok(treeId(16383, 16383) < 2 ** 31);
});

test('the world has every biome somewhere (it is infinite, not a corner map)', () => {
  const found = new Set<string>(), moon = new Set<string>();
  for (let x = -1500; x <= 1500; x += 25) for (let y = -1500; y <= 1500; y += 25) { found.add(biomeAt(x, y)); moon.add(moonBiomeAt(x, y)); }
  for (const b of BIOMES) assert.ok(found.has(b), `biome ${b} never occurs`);
  for (const b of MOON_BIOMES) assert.ok(moon.has(b), `moon biome ${b} never occurs`);
});

test('Earth houses are spread out, valid, and reach many biomes', () => {
  const hs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 140; i++) hs.push(chooseSite(hs));
  assert.ok(spread(hs) >= MIN_DIST, `houses too close: ${spread(hs)}`);
  for (const h of hs) {
    assert.ok(EARTH.ok(h.x, h.y), `invalid site ${h.x},${h.y}`);
    assert.ok(!yardTiles(h.x, h.y).some(([x, y]) => isBlocked(x, y)), 'yard overlaps water, rock or a field');
  }
  const biomes = new Set(hs.map((h) => biomeAt(h.x, h.y)));
  assert.ok(biomes.size >= 6, `only ${biomes.size} biomes populated`);
  assert.ok(biomes.has('desert'), 'nobody lives in the desert');
});

test('Moon colonists are spread out and live in several biomes', () => {
  const hs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 100; i++) hs.push(chooseMoonSite(hs));
  assert.ok(spread(hs) >= MIN_DIST);
  for (const h of hs) { assert.ok(MOON.ok(h.x, h.y)); assert.ok(!yardTiles(h.x, h.y).some(([x, y]) => moonBlocked(x, y))); }
  assert.ok(new Set(hs.map((h) => moonBiomeAt(h.x, h.y))).size >= 4);
});

test('house tiers follow subscription age and long-term members move to the Moon', () => {
  const now = Date.UTC(2026, 0, 1), day = 86_400_000;
  assert.equal(tierFor(now - 5 * day, now), 'hut');
  assert.equal(tierFor(now - 120 * day, now), 'house');
  assert.equal(tierFor(now - 400 * day, now), 'cottage');
  assert.equal(tierFor(now - 800 * day, now), 'manor');
  assert.equal(ageDays(now - 3 * day, now), 3);
  assert.deepEqual(TIERS.map((t) => t.tier), ['hut', 'house', 'cottage', 'manor']);
  assert.equal(isColonist(false, 100), false);
  assert.equal(isColonist(false, 365), true);
  assert.equal(isColonist(true, 1), true);
});
