// Animals that live alongside the villagers, ships that sail the seas. All procedural pixel art, no modern objects.
import { hash2, biomeAt, isOcean, isWater, isLake, isMountain, isRock, CHUNK_TILES as CT, TILE, type Biome } from '@shared';
import { mk, rect, type Cvs } from './art';

export type Move = 'land' | 'water' | 'air' | 'sea';
interface Q { w: number; h: number; lh: number; bh: number; hd: number; body: string; belly?: string; head: string; legs: string; ear?: 'long' | 'antler' | 'horn' | 'small' | 'round'; tail?: string; spots?: string; hump?: boolean; mane?: string; wool?: boolean; neck?: number; eye?: string }
export interface Species { move: Move; speed: number; q?: Q; draw?: (g: CanvasRenderingContext2D, frame: number) => void; w: number; h: number }

const quad = (q: Q): Species['draw'] => (g, frame) => {
  const bodyBot = q.h - q.lh, bodyTop = bodyBot - q.bh, bodyW = q.w - q.hd - 1;
  const lift = (pair: number) => (frame === pair ? 1 : 0);
  for (const [lx, pair] of [[2, 0], [4, 1], [bodyW - 4, 1], [bodyW - 2, 0]] as const) rect(g, lx, bodyBot, 1, q.lh - lift(pair), q.legs);
  if (q.hump) { rect(g, Math.floor(bodyW * 0.35), bodyTop - 3, 5, 3, q.body); rect(g, Math.floor(bodyW * 0.35) + 1, bodyTop - 4, 3, 1, q.body); }
  rect(g, 1, bodyTop, bodyW, q.bh, q.wool ? '#f0eee6' : q.body);
  if (q.wool) { for (let x = 1; x < bodyW; x += 2) { rect(g, x, bodyTop - 1, 2, 1, '#f6f4ee'); rect(g, x, bodyBot - 1, 2, 1, '#dcd8cc'); } }
  if (q.belly) rect(g, 2, bodyBot - 1, bodyW - 2, 1, q.belly);
  if (q.mane) rect(g, bodyW - 3, bodyTop - 1, 3, q.bh, q.mane);
  if (q.spots) for (let i = 0; i < Math.max(2, Math.floor(bodyW / 3)); i++) rect(g, 2 + Math.floor(hash2(i, q.w, 700) * (bodyW - 3)), bodyTop + Math.floor(hash2(i, q.h, 701) * q.bh), 2, 1, q.spots);
  const neck = q.neck ?? 1, headX = q.w - q.hd, headY = bodyTop - neck - 1, hh = Math.max(3, Math.round(q.hd * 0.8));
  rect(g, bodyW - 1, headY + 1, 2, q.bh + neck, q.wool ? '#f0eee6' : q.body);
  rect(g, headX, headY, q.hd, hh, q.head);
  rect(g, q.w - 1, headY + 1, 1, Math.max(1, hh - 1), q.belly ?? q.head);
  rect(g, headX + Math.floor(q.hd * 0.4), headY + 1, 1, 1, q.eye ?? '#1a1210');
  if (q.ear === 'long') { rect(g, headX, headY - 3, 1, 3, q.head); rect(g, headX + 2, headY - 3, 1, 3, q.head); }
  if (q.ear === 'small') { rect(g, headX, headY - 1, 1, 1, q.head); rect(g, headX + q.hd - 2, headY - 1, 1, 1, q.head); }
  if (q.ear === 'round') { rect(g, headX, headY - 1, 2, 1, q.head); }
  if (q.ear === 'horn') { rect(g, headX + 1, headY - 2, 1, 2, '#e8e0cc'); rect(g, headX + 3, headY - 2, 1, 2, '#e8e0cc'); }
  if (q.ear === 'antler') {
    for (const x of [headX, headX + 3]) { rect(g, x, headY - 4, 1, 4, '#d8c8a0'); rect(g, x - 1, headY - 5, 1, 2, '#d8c8a0'); rect(g, x + 1, headY - 4, 1, 1, '#d8c8a0'); }
  }
  if (q.tail) rect(g, 0, bodyTop, 1, 2, q.tail);
};
const bird = (body: string, wing: string, head: string, big = false): Species['draw'] => (g, frame) => {
  const s = big ? 2 : 1;
  rect(g, 3 * s, 4 * s, 6 * s, 2 * s, body); rect(g, 8 * s, 3 * s, 2 * s, 2 * s, head); rect(g, 10 * s, 4 * s, 1 * s, 1, '#e8b030');
  if (frame === 0) { rect(g, 3 * s, 1 * s, 4 * s, 3 * s, wing); rect(g, 2 * s, 0, 2 * s, 2 * s, wing); }
  else { rect(g, 3 * s, 6 * s, 4 * s, 2 * s, wing); rect(g, 2 * s, 7 * s, 2 * s, 1 * s, wing); }
};

const Q = (q: Q): Species => ({ move: 'land', speed: 12, w: q.w, h: q.h, q, draw: quad(q) });
export const SPECIES: Record<string, Species> = {
  rabbit: { ...Q({ w: 11, h: 9, lh: 2, bh: 4, hd: 4, body: '#b8a088', belly: '#e8ddd0', head: '#b8a088', legs: '#8a7660', ear: 'long', tail: '#f4f0e8' }), speed: 26 },
  fox: { ...Q({ w: 15, h: 10, lh: 3, bh: 4, hd: 5, body: '#d8702a', belly: '#f4e8d8', head: '#d8702a', legs: '#3a2a22', ear: 'small', tail: '#f4f0e8', neck: 1 }), speed: 20 },
  deer: { ...Q({ w: 17, h: 15, lh: 6, bh: 4, hd: 5, body: '#9a6a3a', belly: '#e0c8a0', head: '#9a6a3a', legs: '#5a3a22', ear: 'antler', tail: '#e0c8a0', neck: 3 }), speed: 16 },
  reindeer: { ...Q({ w: 17, h: 15, lh: 6, bh: 4, hd: 5, body: '#8a8078', belly: '#eeeae0', head: '#8a8078', legs: '#5a5048', ear: 'antler', tail: '#eeeae0', neck: 3 }), speed: 14 },
  sheep: { ...Q({ w: 14, h: 11, lh: 3, bh: 5, hd: 4, body: '#f0eee6', head: '#3a3028', legs: '#3a3028', wool: true, ear: 'small' }), speed: 7 },
  cow: { ...Q({ w: 19, h: 13, lh: 4, bh: 6, hd: 5, body: '#f4f0e8', head: '#f4f0e8', legs: '#6a5a4a', ear: 'horn', spots: '#3a2a22', tail: '#3a2a22' }), speed: 6 },
  horse: { ...Q({ w: 21, h: 16, lh: 7, bh: 5, hd: 6, body: '#8a5a32', belly: '#6a4222', head: '#8a5a32', legs: '#4a3020', ear: 'small', mane: '#2a1a10', tail: '#2a1a10', neck: 3 }), speed: 18 },
  goat: { ...Q({ w: 13, h: 11, lh: 4, bh: 4, hd: 4, body: '#e8e4d8', head: '#e8e4d8', legs: '#7a7466', ear: 'horn', tail: '#e8e4d8', neck: 1 }), speed: 14 },
  camel: { ...Q({ w: 23, h: 19, lh: 8, bh: 5, hd: 6, body: '#c8a060', belly: '#a8803e', head: '#c8a060', legs: '#8a6830', hump: true, ear: 'small', tail: '#a8803e', neck: 4 }), speed: 9 },
  wolf: { ...Q({ w: 17, h: 11, lh: 4, bh: 4, hd: 5, body: '#7a7a82', belly: '#c8c8d0', head: '#7a7a82', legs: '#4a4a52', ear: 'small', tail: '#6a6a72', neck: 1 }), speed: 22 },
  polarbear: { ...Q({ w: 21, h: 13, lh: 4, bh: 7, hd: 6, body: '#f2f4f6', belly: '#d8dce2', head: '#f2f4f6', legs: '#c8ccd2', ear: 'round', eye: '#1a1a22' }), speed: 8 },
  boar: { ...Q({ w: 16, h: 11, lh: 3, bh: 5, hd: 5, body: '#5a4638', belly: '#4a382c', head: '#5a4638', legs: '#2a1e18', ear: 'small', mane: '#3a2a20' }), speed: 12 },
  jaguar: { ...Q({ w: 17, h: 10, lh: 3, bh: 4, hd: 5, body: '#d8a838', belly: '#f0e0b0', head: '#d8a838', legs: '#a87820', spots: '#3a2a10', ear: 'round', tail: '#a87820' }), speed: 20 },
  frog: { move: 'land', speed: 14, w: 8, h: 6, draw: (g, f) => { rect(g, 1, 2 - f, 6, 3, '#4aa83a'); rect(g, 1, 1 - f, 2, 2, '#4aa83a'); rect(g, 5, 1 - f, 2, 2, '#4aa83a'); rect(g, 1, 1 - f, 1, 1, '#f4f4e8'); rect(g, 6, 1 - f, 1, 1, '#f4f4e8'); rect(g, 0, 5, 2, 1, '#2f7a28'); rect(g, 6, 5, 2, 1, '#2f7a28'); } },
  chicken: { move: 'land', speed: 10, w: 8, h: 8, draw: (g, f) => { rect(g, 1, 3, 5, 3, '#f4f0e6'); rect(g, 5, 1, 2, 3, '#f4f0e6'); rect(g, 5, 0, 1, 1, '#d8342c'); rect(g, 7, 2, 1, 1, '#e8a030'); rect(g, 0, 2, 1, 2, '#d8d0c0'); rect(g, 2, 6, 1, 2 - (f ? 1 : 0), '#e8a030'); rect(g, 4, 6, 1, 2 - (f ? 0 : 1), '#e8a030'); } },
  penguin: { move: 'land', speed: 7, w: 8, h: 12, draw: (g, f) => { rect(g, 1, 2, 6, 8, '#1e2230'); rect(g, 2, 4, 4, 5, '#f4f4f8'); rect(g, 2, 0, 4, 3, '#1e2230'); rect(g, 5, 2, 2, 1, '#e8982a'); rect(g, 3, 1, 1, 1, '#f4f4f8'); rect(g, 0, 5 + f, 1, 3, '#1e2230'); rect(g, 7, 5 + (1 - f), 1, 3, '#1e2230'); rect(g, 2, 10, 2, 2, '#e8982a'); rect(g, 4, 10, 2, 2, '#e8982a'); } },
  duck: { move: 'water', speed: 9, w: 9, h: 8, draw: (g, f) => { rect(g, 1, 3, 6, 3, '#8a6a42'); rect(g, 5, 1, 3, 3, '#2a8a4a'); rect(g, 8, 2, 1, 1, '#e8a030'); rect(g, 2, 2, 3, 1, '#a88a5a'); rect(g, 0, 5 + f, 8, 1, 'rgba(255,255,255,0.35)'); } },
  gull: { move: 'air', speed: 46, w: 12, h: 9, draw: bird('#f4f6f8', '#c8d0d8', '#f4f6f8') },
  eagle: { move: 'air', speed: 40, w: 12, h: 9, draw: bird('#6a4a2a', '#4a3220', '#f4f0e8') },
  parrot: { move: 'air', speed: 38, w: 12, h: 9, draw: bird('#d83a3a', '#2a8ad8', '#d83a3a') },
  vulture: { move: 'air', speed: 32, w: 12, h: 9, draw: bird('#2a2622', '#1a1612', '#c8a0a0') },
};
export const SPECIES_LIST = Object.keys(SPECIES);

export const WILD: Record<Biome, string[]> = {
  emerald: ['deer', 'rabbit', 'fox', 'boar', 'wolf'],
  golden: ['deer', 'rabbit', 'fox', 'boar'],
  blossom: ['rabbit', 'deer', 'fox', 'parrot'],
  blue: ['wolf', 'deer', 'fox', 'rabbit'],
  lime: ['rabbit', 'horse', 'sheep', 'deer', 'fox'],
  snow: ['reindeer', 'polarbear', 'wolf', 'penguin', 'fox'],
  desert: ['camel', 'fox', 'vulture', 'goat'],
  swamp: ['frog', 'boar', 'duck', 'jaguar'],
  tropical: ['jaguar', 'parrot', 'boar', 'frog'],
  mountain: ['goat', 'eagle', 'wolf', 'deer'],
};
export const DOMESTIC: Record<Biome, string[]> = {
  emerald: ['chicken', 'sheep', 'cow', 'horse'], golden: ['chicken', 'cow', 'sheep', 'horse'], blossom: ['chicken', 'sheep', 'goat'],
  blue: ['chicken', 'sheep', 'horse'], lime: ['chicken', 'sheep', 'cow', 'horse'], snow: ['reindeer', 'goat', 'chicken'],
  desert: ['camel', 'goat', 'chicken'], swamp: ['boar', 'duck', 'chicken'], tropical: ['boar', 'chicken', 'parrot'], mountain: ['goat', 'sheep', 'chicken'],
};
const DENSITY: Record<Biome, number> = { emerald: 1.1, golden: 1, blossom: 0.9, blue: 0.8, lime: 1.3, snow: 0.7, desert: 0.5, swamp: 0.9, tropical: 1.1, mountain: 0.6 };

export const ANIMAL_CELL: [number, number] = [28, 22];
export function animalSprite(species: string, frame: number): Cvs {
  const sp = SPECIES[species], c = mk(sp.w, sp.h);
  sp.draw!(c.getContext('2d')!, frame);
  return c;
}

// ---------------------------------------------------------------- ships
export const VESSEL_CELL: [number, number] = [46, 48];
/** A tall ship (caravel) with square sails, or a small sailing boat. Frame 1 billows the sails the other way. */
export function vesselSprite(kind: 'ship' | 'boat', frame: number): Cvs {
  const g0 = kind === 'ship' ? mk(40, 46) : mk(22, 24), g = g0.getContext('2d')!;
  const f = frame ? 1 : 0;
  if (kind === 'ship') {
    rect(g, 2, 40, 36, 3, 'rgba(255,255,255,0.35)');                    // wake / foam
    rect(g, 3, 33, 34, 6, '#6a3e22'); rect(g, 4, 31, 32, 2, '#8a5a30'); rect(g, 2, 34, 2, 3, '#5a3218'); rect(g, 36, 31, 3, 6, '#5a3218');
    rect(g, 6, 38, 28, 1, '#3a2010');
    rect(g, 18, 3, 2, 30, '#5a3a22'); rect(g, 8, 12, 2, 21, '#5a3a22'); rect(g, 29, 14, 2, 19, '#5a3a22');
    const sail = (x: number, y: number, w: number, h: number) => {
      for (let j = 0; j < h; j++) { const bulge = Math.round(Math.sin((j / h) * Math.PI) * (1 + f)); rect(g, x - bulge * (f ? 1 : 0), y + j, w + bulge, 1, j % 5 === 4 ? '#d8cfb8' : '#f4eedc'); }
      rect(g, x, y, w, 1, '#8a7a5a');
    };
    sail(11, 5, 16, 12); sail(11, 18, 16, 11); sail(1, 14, 12, 10); sail(22, 16, 13, 10);
    rect(g, 17, 5, 4, 3, '#c0392b'); rect(g, 20, 1, 7 + f * 2, 3, '#c0392b'); // pennant
  } else {
    rect(g, 1, 20, 20, 2, 'rgba(255,255,255,0.35)');
    rect(g, 2, 16, 18, 4, '#7a4a28'); rect(g, 3, 15, 16, 1, '#9a6a3a'); rect(g, 1, 16, 2, 2, '#5a3218');
    rect(g, 10, 2, 1, 14, '#5a3a22');
    for (let j = 0; j < 11; j++) { const b = Math.round(Math.sin((j / 11) * Math.PI) * (1 + f)); rect(g, 11, 3 + j, 7 + b, 1, '#f4eedc'); }
  }
  return g0;
}

// ---------------------------------------------------------------- where the wildlife is
export interface Spawn { id: string; species: string; x: number; y: number }
const cache = new Map<string, Spawn[]>();
/** Deterministic wildlife and ships for one chunk (pixel coordinates). */
export function wildlifeInChunk(cx: number, cy: number): Spawn[] {
  const key = `${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Spawn[] = [];
  const x0 = cx * CT, y0 = cy * CT;
  for (let k = 0; k < 5; k++) {
    const tx = x0 + Math.floor(hash2(cx * 11 + k, cy, 500) * CT), ty = y0 + Math.floor(hash2(cx * 13 + k, cy, 501) * CT);
    const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
    if (isOcean(tx, ty)) {
      const deep = [[3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dy]) => isOcean(tx + dx, ty + dy));
      if (!deep) continue;
      const r = hash2(cx * 17 + k, cy, 502);
      out.push({ id: `${key}:${k}`, species: r < 0.45 ? 'ship' : r < 0.7 ? 'boat' : 'gull', x: px, y: py });
      continue;
    }
    if (isLake(tx, ty)) { if (hash2(cx * 19 + k, cy, 503) < 0.5) out.push({ id: `${key}:${k}`, species: hash2(cx, cy + k, 504) < 0.7 ? 'duck' : 'boat', x: px, y: py }); continue; }
    if (isWater(tx, ty) || isMountain(tx, ty) || isRock(tx, ty)) { if (isMountain(tx, ty) && hash2(cx * 23 + k, cy, 505) < 0.3) out.push({ id: `${key}:${k}`, species: 'eagle', x: px, y: py }); continue; }
    const b = biomeAt(tx, ty);
    if (hash2(cx * 29 + k, cy, 506) > DENSITY[b] * 0.55) continue;
    const list = WILD[b];
    out.push({ id: `${key}:${k}`, species: list[Math.floor(hash2(cx * 31 + k, cy, 507) * list.length)], x: px, y: py });
  }
  if (cache.size > 900) cache.clear();
  cache.set(key, out);
  return out;
}
