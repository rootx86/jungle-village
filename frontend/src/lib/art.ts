// Procedural pixel art. Everything is drawn into tiny canvases at 1 canvas px = 1 world px and
// shown with NearestFilter, so no image assets are needed. Replace with real sprite sheets any time.
import { hash2, type Tier } from '@shared';

export type Cvs = HTMLCanvasElement;
export const mk = (w: number, h: number): Cvs => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
export const rect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};
const ctx = (c: Cvs) => c.getContext('2d')!;

// ---------------------------------------------------------------- trees
export type Pal = [string, string, string, string]; // dark -> light
export function pine(v: number, pal: Pal, trunk = '#4a2f1c'): Cvs {
  const c = mk(16, 28), g = ctx(c);
  rect(g, 7, 23, 2, 5, trunk);
  for (let t = 0; t < 4; t++) {
    const top = t * 5, maxHalf = 3.4 + t * 1.3;
    for (let i = 0; i < 9; i++) {
      const hw = Math.round(1 + (maxHalf - 1) * (i / 8));
      for (let x = 8 - hw; x < 8 + hw; x++) {
        let s = x < 8 - hw * 0.35 ? 3 : x < 8 + hw * 0.25 ? 2 : 1;
        if (i % 3 === 2) s = Math.max(0, s - 1);
        if (hash2(x + v * 31, top + i, 4) > 0.9) s = Math.min(3, s + 1);
        rect(g, x, top + i, 1, 1, pal[s]);
      }
    }
  }
  return c;
}
export function round(v: number, pal: Pal, trunk = '#4a2f1c', birch = false): Cvs {
  const c = mk(18, 22), g = ctx(c);
  rect(g, 8, 15, 2, 7, trunk);
  if (birch) for (let y = 16; y < 22; y += 2) rect(g, 8, y, 2, 1, '#2a2a2a');
  const blobs: Array<[number, number, number]> = [[9, 8, 7], [5, 10, 5], [13, 10, 5], [9, 5, 5]];
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    if (!blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)) continue;
    const l = (9 - x + 7 - y) * 0.07 + (hash2(x + v * 17, y, 9) - 0.5) * 0.7;
    rect(g, x, y, 1, 1, pal[l > 0.5 ? 3 : l > 0.05 ? 2 : l > -0.45 ? 1 : 0]);
  }
  return c;
}
const P = {
  emerald: ['#0e3322', '#15492f', '#1f6039', '#2d7a47'] as Pal,
  emerald2: ['#103a26', '#1a5435', '#26703f', '#389050'] as Pal,
  blue: ['#10313f', '#18505f', '#24707f', '#3a95a3'] as Pal,
  lime: ['#1d4a18', '#2f6c22', '#4a9430', '#72bd42'] as Pal,
  green: ['#1d4f24', '#2a6a2c', '#3d8837', '#58a644'] as Pal,
  orange: ['#8f5413', '#b8731b', '#d6942a', '#eab953'] as Pal,
  golden: ['#9a7a14', '#cba324', '#ecc83e', '#fbea85'] as Pal,
  red: ['#5e1620', '#8f2428', '#c4402c', '#ec7040'] as Pal,
  blossom: ['#9a4070', '#cc6494', '#ea8fb8', '#fcc6da'] as Pal,
  birch: ['#4a8236', '#68a844', '#8ccb5a', '#b8e684'] as Pal,
};
/** kind: see treeAt() in shared.ts */
export function treeSprite(kind: number, v: number): Cvs {
  switch (kind) {
    case 1: return pine(v, v % 2 ? P.emerald2 : P.emerald);
    case 2: return round(v, P.green);
    case 3: return round(v, P.orange);
    case 4: return round(v, P.blossom, '#5a3a30');
    case 5: return round(v, P.golden);
    case 6: return round(v, P.red);
    case 7: return pine(v, P.blue, '#3a2a22');
    case 8: return round(v, P.birch, '#e8e6dc', true);
    default: return pine(v, P.lime);
  }
}
export const TREE_KINDS = 9;

// ---------------------------------------------------------------- ground decoration
const FLOWERS = ['#fff6d0', '#ffd23f', '#ff7aa8', '#b78cff', '#6ec6ff', '#ff8a4a'];
export function decorSprite(kind: number, seed: number): Cvs {
  const c = mk(16, 16), g = ctx(c);
  const r = (i: number) => hash2(seed, i, 200);
  if (kind === 1) { // flower cluster
    for (let i = 0; i < 3; i++) {
      const x = 2 + Math.floor(r(i) * 11), y = 3 + Math.floor(r(i + 9) * 10), col = FLOWERS[Math.floor(r(i + 4) * FLOWERS.length)];
      rect(g, x, y + 1, 1, 2, '#2f7a34'); rect(g, x - 1, y, 3, 1, col); rect(g, x, y - 1, 1, 3, col); rect(g, x, y, 1, 1, '#fff');
    }
  } else if (kind === 2) { // mushroom
    const x = 4 + Math.floor(r(1) * 7), y = 9 + Math.floor(r(2) * 4);
    rect(g, x, y, 2, 3, '#efe6d0'); rect(g, x - 1, y - 2, 4, 2, '#d8342c'); rect(g, x, y - 2, 1, 1, '#fff');
  } else if (kind === 3) { // fern
    const x = 8, y = 14;
    for (let i = 0; i < 6; i++) { rect(g, x - i, y - i, 1, 1, '#3f9a4a'); rect(g, x + i, y - i, 1, 1, '#4fb05a'); rect(g, x, y - i, 1, 1, '#2f7a3a'); }
  } else if (kind === 4) { // small rock
    const x = 4 + Math.floor(r(1) * 6), y = 9 + Math.floor(r(2) * 4);
    rect(g, x, y, 5, 3, '#7c7a74'); rect(g, x + 1, y - 1, 3, 1, '#9a978f'); rect(g, x, y + 2, 5, 1, '#55534e');
  } else if (kind === 5) { // grass tuft
    for (let i = 0; i < 4; i++) { const x = 3 + Math.floor(r(i) * 10); rect(g, x, 10 + (i % 2), 1, 4, i % 2 ? '#4fa04a' : '#6cc25a'); }
  } else { // reed
    for (let i = 0; i < 3; i++) { const x = 3 + Math.floor(r(i) * 10); rect(g, x, 4, 1, 11, '#7a9a4a'); rect(g, x - 1, 3, 3, 3, '#7a4a28'); }
  }
  return c;
}
export function rockTile(x: number, y: number, topEdge: boolean, bottomEdge: boolean): Cvs {
  const c = mk(16, 16), g = ctx(c);
  const base = ['#6d6a64', '#7a766e', '#625f5a'][Math.floor(hash2(x, y, 300) * 3)];
  rect(g, 0, 0, 16, 16, base);
  for (let j = 3; j < 16; j += 5) rect(g, 0, j + (x % 2), 16, 1, 'rgba(0,0,0,0.22)');
  for (let i = 0; i < 6; i++) rect(g, Math.floor(hash2(x, y, 310 + i) * 15), Math.floor(hash2(x, y, 320 + i) * 15), 2, 1, 'rgba(255,255,255,0.12)');
  if (hash2(x, y, 330) > 0.55) rect(g, Math.floor(hash2(x, y, 331) * 8), 0, 8, 3, '#4f8a3a'); // moss
  if (topEdge) rect(g, 0, 0, 16, 2, '#a8a59a');
  if (bottomEdge) rect(g, 0, 12, 16, 4, '#46433f');
  return c;
}
/** Tileable falling-water texture (scrolled by the scene). */
export function fallTexture(): Cvs {
  const c = mk(32, 64), g = ctx(c);
  rect(g, 0, 0, 32, 64, '#4a9be0');
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash2(i, 1, 400) * 31), y = Math.floor(hash2(i, 2, 400) * 64), len = 6 + Math.floor(hash2(i, 3, 400) * 22);
    const col = hash2(i, 4, 400) > 0.5 ? '#d6efff' : '#8fc8f5';
    for (let k = 0; k < len; k++) rect(g, x, (y + k) % 64, 1 + (i % 3 === 0 ? 1 : 0), 1, col);
  }
  return c;
}
export function softBlob(rgb = '255,255,255', a = 0.7): Cvs {
  const c = mk(64, 64), g = ctx(c);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},${a})`); grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return c;
}

// ---------------------------------------------------------------- villagers
export type Pose = 'stand' | 'walk0' | 'walk1' | 'chop0' | 'chop1' | 'sit';
const HAIR = ['#2b1b12', '#6b3a1e', '#c9a13a', '#1e2f5a', '#a8362e', '#e8e8f0', '#3a7a4a'];
const SHIRT = ['#c0392b', '#2e7d9a', '#d4a02f', '#6a4c93', '#3f8f4f', '#e07a5f', '#d8d8d8'];
const cache = new Map<string, Cvs>();
const HATS: Record<string, { c: string; c2: string; brim?: boolean; shirt?: string }> = {
  farmer: { c: '#f0d878', c2: '#e8c860', brim: true },
  woodcutter: { c: '#c0392b', c2: '#8e2a20' },
  miner: { c: '#f2c230', c2: '#fff6c0', shirt: '#6a5a4a' },
  fisher: { c: '#3a7ab8', c2: '#2e6aa0', brim: true },
  blacksmith: { c: '#303030', c2: '#303030', shirt: '#4a4a4a' },
  baker: { c: '#fafafa', c2: '#e0e0e0', shirt: '#f2efe6' },
  hunter: { c: '#3a6a3a', c2: '#2a5a2a', brim: true, shirt: '#4a6a3a' },
  merchant: { c: '#8a52c0', c2: '#6a3a9a', brim: true },
  guard: { c: '#9aa0aa', c2: '#7a808a', shirt: '#6a7a9a' },
  bard: { c: '#ee6aa6', c2: '#d84a8a', brim: true },
};
export function villagerSprite(seed: number, pose: Pose, job?: string): Cvs {
  const hat = job ? HATS[job] : undefined;
  const hair = HAIR[seed % HAIR.length], shirt = hat?.shirt ?? SHIRT[(seed * 3 + 1) % SHIRT.length];
  const key = `${hair}${shirt}${pose}${job ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = mk(16, 16), g = ctx(c);
  const o = 2; // body offset inside 16px canvas (room for the axe)
  const sit = pose === 'sit', dy = sit ? 3 : 0;
  rect(g, o + 2, 1 + dy, 6, 2, hair); rect(g, o + 1, 2 + dy, 1, 3, hair); rect(g, o + 8, 2 + dy, 1, 3, hair);
  rect(g, o + 2, 3 + dy, 6, 3, '#f0c8a0');
  rect(g, o + 3, 4 + dy, 1, 1, '#2a1a10'); rect(g, o + 6, 4 + dy, 1, 1, '#2a1a10');
  if (hat) {
    rect(g, o + 2, dy, 6, 2, hat.c);
    if (hat.brim) rect(g, o + 1, 1 + dy, 8, 1, hat.c2);
    else rect(g, o + 3, dy, 2, 1, hat.c2);
  }
  rect(g, o + 2, 6 + dy, 6, 5, shirt);
  rect(g, o + 2, 10 + dy, 6, 1, '#4a3320');
  if (sit) {
    rect(g, o + 1, 10 + dy, 8, 2, '#3a4a6a');
  } else {
    const l = pose === 'walk0' ? 0 : 1, r = pose === 'walk1' ? 0 : 1;
    rect(g, o + 2, 11, 2, 4 - l, '#3a4a6a'); rect(g, o + 6, 11, 2, 4 - r, '#3a4a6a');
    rect(g, o + 2, 15 - l, 2, 1, '#2a1a10'); rect(g, o + 6, 15 - r, 2, 1, '#2a1a10');
  }
  if (pose === 'chop0') { // axe raised
    rect(g, o + 8, 6, 1, 3, '#f0c8a0'); rect(g, o + 9, 1, 1, 6, '#7a5230'); rect(g, o + 9, 0, 3, 3, '#aab0b8');
    rect(g, o, 6, 2, 3, shirt);
  } else if (pose === 'chop1') { // axe swung forward
    rect(g, o + 8, 8, 1, 2, '#f0c8a0'); rect(g, o + 9, 9, 4, 1, '#7a5230'); rect(g, o + 12, 7, 2, 4, '#aab0b8');
    rect(g, o, 6, 2, 4, shirt);
  } else {
    rect(g, o, 6, 2, 4, shirt); rect(g, o + 8, 6, 2, 4, shirt);
  }
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- houses
function roofTri(g: CanvasRenderingContext2D, cx: number, y0: number, h: number, half: number, p: string[]) {
  for (let i = 0; i < h; i++) {
    const hw = Math.max(1, Math.round(1 + (half - 1) * (i / (h - 1)))), y = y0 + i;
    rect(g, cx - hw, y, hw * 2, 1, i % 3 === 2 ? p[3] : p[0]);
    rect(g, cx - hw, y, 1, 1, p[1]); rect(g, cx + hw - 1, y, 1, 1, p[2]);
    if (i % 3 === 0) rect(g, cx - hw + 1, y, Math.max(0, hw - 1), 1, p[1]);
  }
}
function planks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string) {
  rect(g, x, y, w, h, a);
  for (let i = 2; i < w; i += 3) rect(g, x + i, y, 1, h, b);
}
function bricks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string) {
  rect(g, x, y, w, h, a);
  for (let j = 2; j < h; j += 3) {
    rect(g, x, y + j, w, 1, b);
    for (let i = (j / 3) % 2 ? 2 : 5; i < w; i += 6) rect(g, x + i, y + j - 2, 1, 2, b);
  }
}
const shadow = (g: CanvasRenderingContext2D, x: number, y: number, w: number) => rect(g, x, y, w, 2, 'rgba(0,0,0,0.35)');

export const HOUSE_SIZE: Record<Tier | 'site', [number, number]> = {
  hut: [32, 28], house: [32, 34], cottage: [36, 38], manor: [48, 46], site: [32, 28],
};

export function houseSprite(tier: Tier | 'site'): Cvs {
  const [w, h] = HOUSE_SIZE[tier];
  const c = mk(w, h), g = ctx(c);
  if (tier === 'hut') {
    shadow(g, 5, 26, 22);
    planks(g, 7, 15, 18, 11, '#6b4a2a', '#4f351d');
    rect(g, 14, 19, 4, 7, '#2a1a10');
    roofTri(g, 16, 1, 15, 15, ['#b88a3c', '#d6ac55', '#8c6528', '#a07430']);
  } else if (tier === 'house') {
    shadow(g, 3, 32, 26);
    rect(g, 22, 4, 3, 8, '#5a4a42');
    planks(g, 4, 17, 24, 15, '#9a6b3a', '#74502a');
    rect(g, 13, 22, 5, 10, '#3a2314');
    rect(g, 6, 21, 5, 5, '#f2c75c'); rect(g, 6, 23, 5, 1, '#8a5a24'); rect(g, 8, 21, 1, 5, '#8a5a24');
    rect(g, 21, 21, 5, 5, '#f2c75c'); rect(g, 23, 21, 1, 5, '#8a5a24');
    roofTri(g, 16, 2, 16, 16, ['#a8402f', '#c25a42', '#7c2c20', '#933626']);
  } else if (tier === 'cottage') {
    shadow(g, 2, 36, 32);
    rect(g, 26, 3, 4, 10, '#7b4b3b'); rect(g, 26, 3, 4, 1, '#4a2a22');
    bricks(g, 3, 28, 30, 9, '#8b8b8f', '#66666b');
    rect(g, 3, 17, 30, 11, '#e8dcb8');
    for (const x of [3, 17, 32]) rect(g, x, 17, 1, 11, '#5a3a22');
    rect(g, 3, 27, 30, 1, '#5a3a22');
    rect(g, 15, 27, 6, 10, '#4a2a18'); rect(g, 19, 32, 1, 1, '#e8c060');
    rect(g, 7, 20, 5, 5, '#f6d36b'); rect(g, 24, 20, 5, 5, '#f6d36b');
    rect(g, 9, 20, 1, 5, '#5a3a22'); rect(g, 26, 20, 1, 5, '#5a3a22');
    roofTri(g, 18, 0, 19, 18, ['#4f6f9a', '#6a8fbf', '#38527a', '#5b7eaa']);
  } else if (tier === 'manor') {
    shadow(g, 1, 44, 46);
    bricks(g, 1, 26, 15, 18, '#a39d94', '#7d776e'); bricks(g, 32, 26, 15, 18, '#a39d94', '#7d776e');
    roofTri(g, 8, 18, 9, 9, ['#7a2a3a', '#9a4050', '#561c28', '#6a2432']);
    roofTri(g, 39, 18, 9, 9, ['#7a2a3a', '#9a4050', '#561c28', '#6a2432']);
    bricks(g, 14, 12, 20, 32, '#b8b2a6', '#8d877c');
    roofTri(g, 24, 0, 13, 12, ['#7a2a3a', '#9a4050', '#561c28', '#6a2432']);
    rect(g, 23, 0, 1, 3, '#d8d8d8'); rect(g, 24, 0, 4, 2, '#d4a02f');
    rect(g, 21, 18, 6, 6, '#ffd870'); rect(g, 23, 18, 2, 6, '#6a5a3a');
    rect(g, 20, 34, 8, 10, '#3a2314'); rect(g, 24, 34, 1, 10, '#241408'); rect(g, 22, 38, 1, 1, '#e8c060');
    for (const [x, y] of [[4, 31], [10, 31], [35, 31], [41, 31], [17, 28], [29, 28]]) rect(g, x, y, 3, 4, '#ffd870');
    rect(g, 0, 43, 48, 1, '#5a554d');
  } else { // construction site: poles, beams, wood pile
    shadow(g, 4, 26, 24);
    for (const x of [6, 12, 19, 25]) rect(g, x, 8, 2, 18, '#7a5230');
    rect(g, 6, 12, 21, 2, '#9a6b3a'); rect(g, 6, 19, 21, 2, '#9a6b3a');
    rect(g, 1, 22, 6, 3, '#8a5a30'); rect(g, 2, 20, 5, 2, '#a0703a');
  }
  return c;
}

// ---------------------------------------------------------------- campfire
export function flameSprite(frame: number): Cvs {
  const c = mk(12, 16), g = ctx(c);
  rect(g, 1, 12, 10, 2, '#4a2f1c'); rect(g, 2, 11, 8, 1, '#6a4428');
  const h = [9, 11, 8][frame % 3];
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, Math.round(6 - Math.abs(i - h * 0.4) * 0.9));
    rect(g, 6 - Math.floor(w / 2) + (frame % 2 ? 1 : 0) * (i > 6 ? 1 : 0), 12 - i, w, 1, i < 3 ? '#fff0a0' : i < 6 ? '#ffb02e' : '#e8501c');
  }
  return c;
}
export function glowSprite(): Cvs {
  const c = mk(256, 256), g = ctx(c);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,170,70,0.55)');
  grad.addColorStop(0.4, 'rgba(255,140,50,0.2)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  return c;
}
export function bonesSprite(): Cvs {
  const c = mk(40, 14), g = ctx(c);
  rect(g, 1, 3, 7, 6, '#e6e2d4'); rect(g, 0, 5, 3, 3, '#e6e2d4'); rect(g, 3, 5, 1, 1, '#2a2018'); rect(g, 6, 5, 1, 1, '#2a2018');
  rect(g, 9, 6, 28, 1, '#e6e2d4');
  for (let x = 12; x < 34; x += 4) { rect(g, x, 3, 1, 4, '#d6d2c4'); rect(g, x, 7, 1, 3, '#d6d2c4'); }
  return c;
}
