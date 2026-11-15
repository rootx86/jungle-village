// Dependency-free code shared by backend AND frontend (the frontend imports it through the @shared alias).
// Both worlds (Earth and the Moon) are INFINITE and generated deterministically from tile coordinates, so every
// visitor sees the same planet and the backend can place houses on it. Only houses live in Postgres.

export const TILE = 16;
export const CHUNK_TILES = 25;              // streaming unit: 25 x 25 tiles
export const SEED = 1337;
export const CENTER = { x: 100, y: 100 };   // campfire clearing (the original village centre)

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s + SEED, 2147483629)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Two octaves of value noise, roughly 0..1 with mean 0.5. `sc` is the feature size in tiles. */
export const fbm = (x: number, y: number, s: number, sc: number) =>
  0.65 * vnoise(x / sc, y / sc, s) + 0.35 * vnoise(x / (sc / 2.3) + 17, y / (sc / 2.3) + 9, s + 1);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const clearingDist = (x: number, y: number) => Math.hypot(x - CENTER.x, (y - CENTER.y) * 1.15);
const homeDist = (x: number, y: number) => Math.hypot(x - CENTER.x, y - CENTER.y);

// ---- rocket launch complex (east of the village, in its own patch of desert) ----
export const LAUNCH = { x0: 163, y0: 154, x1: 185, y1: 182 };
export const PAD = { x0: 170, y0: 161, x1: 182, y1: 175 };
export const ROCKET = { x: 176, y: 169 };
export const LAUNCH_C = { x: 174, y: 168 };
export const isLaunch = (x: number, y: number) => x >= LAUNCH.x0 && x <= LAUNCH.x1 && y >= LAUNCH.y0 && y <= LAUNCH.y1;
export const isPad = (x: number, y: number) => x >= PAD.x0 && x <= PAD.x1 && y >= PAD.y0 && y <= PAD.y1;
const launchDist = (x: number, y: number) => Math.hypot(x - LAUNCH_C.x, y - LAUNCH_C.y);

// ---- mountains: noise massifs anywhere (never next to the village or the launch pad) ----
export function altitude(x: number, y: number): number {
  const damp = smoothstep(55, 95, homeDist(x, y)) * smoothstep(34, 58, launchDist(x, y));
  if (damp <= 0) return 0;
  return clamp01((fbm(x, y, 61, 120) - 0.66) / 0.18) * damp;
}
export const isMountain = (x: number, y: number) => altitude(x, y) > 0.3;
export const inMountainRegion = (x: number, y: number) => altitude(x, y) > 0.02;
export interface Peak { x: number; y: number; size: 0 | 1 | 2; v: number }
/** One candidate peak per 4x4 cell (jittered), bigger towards the summit. */
export function peakInCell(cx: number, cy: number): Peak | null {
  if (hash2(cx, cy, 90) > 0.82) return null;
  const x = Math.floor(cx * 4 + hash2(cx, cy, 91) * 4), y = Math.floor(cy * 4 + hash2(cx, cy, 92) * 4);
  const a = altitude(x, y);
  if (a < 0.33) return null;
  return { x, y, size: (a > 0.62 ? 2 : a > 0.45 ? 1 : 0) as 0 | 1 | 2, v: Math.floor(hash2(cx, cy, 93) * 4) };
}

// ---- water: meandering rivers (contours of a noise field), lakes, murky swamp pools ----
export function isRiver(x: number, y: number): boolean {
  if (homeDist(x, y) < 50 || launchDist(x, y) < 40) return false;
  return Math.abs(fbm(x, y, 150, 85) - 0.5) < 0.014;
}
export function isLake(x: number, y: number): boolean {
  if (homeDist(x, y) < 56 || launchDist(x, y) < 44) return false;
  return fbm(x, y, 160, 62) > 0.72;
}
/** Where a river climbs into the mountains it falls over a ledge: a vertical sheet of water. */
export function isFall(x: number, y: number): boolean {
  if (!isRiver(x, y)) return false;
  const a = altitude(x, y);
  return a > 0.2 && a < 0.34;
}
export function isRock(x: number, y: number): boolean {
  const a = altitude(x, y);
  if (a < 0.1 || a > 0.4 || isFall(x, y) || isRiver(x, y)) return false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isFall(x + dx, y + dy)) return true;
  return false;
}
export function isSwampPool(x: number, y: number): boolean {
  return vnoise(x / 4.5, y / 4.5, 83) > 0.66 && biomeAt(x, y) === 'swamp';
}
export function isWater(x: number, y: number): boolean {
  return isLake(x, y) || isRiver(x, y) || isSwampPool(x, y);
}
export const MUD = { x: 80, y: 50, rx: 8, ry: 4 };
export function inEllipse(x: number, y: number, e: { x: number; y: number; rx: number; ry: number }) {
  return ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1;
}
export const isMud = (x: number, y: number) => inEllipse(x, y, MUD);

// ---- farmlands (a fixed ring of fields around the home village) ----
export type Crop = 'wheat' | 'sunflower' | 'pumpkin' | 'cabbage' | 'lavender' | 'corn';
export interface Farm { x0: number; y0: number; w: number; h: number; crop: Crop; gx: number; gy: number }
export const FARMS: Farm[] = [
  { x0: 66, y0: 90, w: 11, h: 8, crop: 'wheat', gx: 77, gy: 94 },
  { x0: 66, y0: 102, w: 11, h: 8, crop: 'sunflower', gx: 77, gy: 105 },
  { x0: 123, y0: 98, w: 10, h: 8, crop: 'pumpkin', gx: 122, gy: 102 },
  { x0: 123, y0: 110, w: 10, h: 7, crop: 'lavender', gx: 122, gy: 113 },
  { x0: 90, y0: 122, w: 10, h: 7, crop: 'cabbage', gx: 95, gy: 121 },
  { x0: 84, y0: 68, w: 10, h: 7, crop: 'corn', gx: 88, gy: 76 },
];
export const BARN = { x: 137, y: 104 };
export const WINDMILL = { x: 62, y: 99 };
const FARM_EXTRAS = [{ x0: 134, y0: 99, x1: 140, y1: 105 }, { x0: 59, y0: 94, x1: 65, y1: 100 }];
export function farmAt(x: number, y: number): Farm | null {
  for (const f of FARMS) if (x >= f.x0 && x < f.x0 + f.w && y >= f.y0 && y < f.y0 + f.h) return f;
  return null;
}
export function isFarm(x: number, y: number): boolean {
  if (x < 55 || x > 145 || y < 60 || y > 135) return false;
  for (const f of FARMS) if (x >= f.x0 - 1 && x <= f.x0 + f.w && y >= f.y0 - 1 && y <= f.y0 + f.h) return true;
  return FARM_EXTRAS.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
}
export function isFence(x: number, y: number): Farm | null {
  for (const f of FARMS) {
    if (x < f.x0 - 1 || x > f.x0 + f.w || y < f.y0 - 1 || y > f.y0 + f.h) continue;
    if (x === f.gx && y === f.gy) continue;
    if (x === f.x0 - 1 || x === f.x0 + f.w || y === f.y0 - 1 || y === f.y0 + f.h) return f;
  }
  return null;
}
export function isPath(x: number, y: number): boolean {
  if (x < 60 || x > 130 || y < 60 || y > 130) return false;
  if (clearingDist(x, y) < 6.5) return false;
  for (const f of FARMS) {
    if (y === CENTER.y && x >= Math.min(CENTER.x, f.gx) && x <= Math.max(CENTER.x, f.gx)) return true;
    if (x === f.gx && y >= Math.min(CENTER.y, f.gy) && y <= Math.max(CENTER.y, f.gy)) return true;
  }
  return false;
}
export const isBlocked = (x: number, y: number) => isWater(x, y) || isRock(x, y) || isMountain(x, y) || isFarm(x, y) || isLaunch(x, y) || isMud(x, y);

// ---- biomes: climate fields (temperature x wetness) with warped, organic borders ----
export type Biome = 'emerald' | 'golden' | 'blossom' | 'blue' | 'lime' | 'snow' | 'desert' | 'swamp' | 'tropical' | 'mountain';
export const BIOMES: Biome[] = ['emerald', 'golden', 'blossom', 'blue', 'lime', 'snow', 'desert', 'swamp', 'tropical', 'mountain'];
export function biomeAt(x: number, y: number): Biome {
  if (altitude(x, y) > 0.02) return 'mountain';
  const wx = x + (vnoise(x / 34, y / 34, 70) - 0.5) * 44, wy = y + (vnoise(x / 34, y / 34, 71) - 0.5) * 44;
  if (launchDist(wx, wy) < 36) return 'desert';
  if (clearingDist(x, y) < 20) return 'lime';
  const near = 1 - smoothstep(50, 95, homeDist(x, y)); // keep the home region temperate
  const temp = fbm(wx, wy, 41, 150) * (1 - near) + 0.5 * near;
  const wet = fbm(wx, wy, 42, 120) * (1 - near) + 0.5 * near;
  if (temp < 0.4) return wet > 0.52 ? 'blue' : 'snow';
  if (temp > 0.6) return wet < 0.47 ? 'desert' : wet > 0.62 ? 'swamp' : 'tropical';
  if (wet > 0.66) return 'swamp';
  const n1 = vnoise(x / 26, y / 26, 43), n2 = vnoise(x / 26, y / 26, 57);
  if (n1 > 0.64) return 'golden';
  if (n1 < 0.32) return n2 > 0.45 ? 'blossom' : 'blue';
  if (n2 > 0.72) return 'lime';
  return 'emerald';
}
/** Biome with a small random offset: used for trees and decoration so borders are ragged and mixed. */
export function biomeJ(x: number, y: number): Biome {
  return biomeAt(x + (hash2(Math.floor(x), Math.floor(y), 201) - 0.5) * 9, y + (hash2(Math.floor(x), Math.floor(y), 202) - 0.5) * 9);
}

/** Tree kinds: 0 none, 1 emerald pine, 2 round green, 3 orange maple, 4 pink blossom, 5 golden, 6 red maple, 7 blue spruce, 8 birch, 9 lime pine,
 *  10 snow pine, 11 frosted bare tree, 12 cactus, 13 palm, 14 acacia, 15 willow, 16 broadleaf, 17 dead tree */
export function treeAt(x: number, y: number): number {
  if (isWater(x, y) || isMud(x, y) || isRock(x, y) || isMountain(x, y) || isFarm(x, y) || isPath(x, y) || isLaunch(x, y)) return 0;
  const d = clearingDist(x, y);
  if (d < 7.5) return 0;
  const b = biomeJ(x, y);
  let density = b === 'lime' ? 0.62 : b === 'desert' ? 0.13 : b === 'swamp' ? 0.62 : b === 'snow' ? 0.72 : b === 'tropical' ? 0.88 : 0.84;
  if (b === 'mountain') density = 0.55;
  if (d < 10) density *= 0.55;
  density *= Math.max(0.3, Math.min(1.2, 0.42 + 1.15 * vnoise(x / 6.5, y / 6.5, 85))); // thickets and glades
  if (hash2(x, y, 7) > density) return 0;
  const r = hash2(x, y, 23);
  switch (b) {
    case 'mountain': return r < 0.55 ? 1 : r < 0.85 ? 7 : 10;
    case 'snow': return r < 0.7 ? 10 : r < 0.86 ? 11 : 7;
    case 'desert': return r < 0.45 ? 12 : r < 0.62 ? 13 : r < 0.85 ? 14 : 17;
    case 'swamp': return r < 0.58 ? 15 : r < 0.74 ? 17 : 2;
    case 'tropical': return r < 0.42 ? 13 : r < 0.88 ? 16 : 9;
    case 'golden': return r < 0.4 ? 5 : r < 0.62 ? 3 : r < 0.78 ? 6 : r < 0.9 ? 1 : 2;
    case 'blossom': return r < 0.5 ? 4 : r < 0.68 ? 8 : r < 0.84 ? 2 : 1;
    case 'blue': return r < 0.72 ? 7 : r < 0.88 ? 1 : 8;
    case 'lime': return r < 0.4 ? 9 : r < 0.62 ? 2 : r < 0.74 ? 4 : r < 0.86 ? 8 : 1;
    default: return r < 0.62 ? 1 : r < 0.84 ? 2 : r < 0.92 ? 9 : r < 0.96 ? 3 : 8;
  }
}
/** Houses can also go on open ground in sparse biomes (nothing to chop there). */
export const OPEN_BUILD: Biome[] = ['desert', 'snow', 'mountain', 'swamp', 'tropical'];

/** Ground decoration: 0 none, 1 flower, 2 mushroom, 3 fern, 4 small rock, 5 grass tuft, 6 reed, 7 ice crystal, 8 dry bush, 9 cattail, 10 hibiscus, 11 bones */
export function decorAt(x: number, y: number): number {
  if (isWater(x, y) || isRock(x, y) || isMud(x, y) || isMountain(x, y) || isFarm(x, y) || isPath(x, y) || isLaunch(x, y)) return 0;
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWater(x + dx, y + dy));
  const r = hash2(x, y, 101);
  if (near) return r < 0.35 ? 6 : 0;
  const b = biomeJ(x, y);
  const p = b === 'lime' ? 0.3 : b === 'blossom' ? 0.16 : b === 'tropical' ? 0.28 : b === 'swamp' ? 0.2 : b === 'snow' ? 0.14 : 0.1;
  if (r > p) return 0;
  const k = hash2(x, y, 102);
  if (b === 'mountain') return k < 0.6 ? 4 : k < 0.85 ? 5 : 1;
  if (b === 'snow') return k < 0.55 ? 7 : k < 0.8 ? 4 : 5;
  if (b === 'desert') return k < 0.5 ? 8 : k < 0.82 ? 4 : 11;
  if (b === 'swamp') return k < 0.4 ? 9 : k < 0.75 ? 2 : 3;
  if (b === 'tropical') return k < 0.5 ? 10 : k < 0.8 ? 3 : 1;
  if (b === 'lime' || b === 'blossom') return k < 0.6 ? 1 : k < 0.75 ? 5 : k < 0.88 ? 3 : 2;
  return k < 0.28 ? 1 : k < 0.5 ? 2 : k < 0.72 ? 3 : k < 0.86 ? 4 : 5;
}

/** Unique integer per tile that fits a Postgres INTEGER (|x|, |y| < 16384). */
export const treeId = (x: number, y: number) => (x + 16384) * 32768 + (y + 16384);

/** Tiles of the cleared yard around a house centred on tile (hx, hy): 4x4 tiles. */
export function yardTiles(hx: number, hy: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = hy - 2; y <= hy + 1; y++) for (let x = hx - 2; x <= hx + 1; x++) out.push([x, y]);
  return out;
}

export type Tier = 'hut' | 'house' | 'cottage' | 'manor';
export const TIERS: Array<{ tier: Tier; label: string; minDays: number }> = [
  { tier: 'hut', label: 'Straw hut', minDays: 0 },
  { tier: 'house', label: 'Wooden house', minDays: 90 },
  { tier: 'cottage', label: 'Cottage', minDays: 365 },
  { tier: 'manor', label: 'Manor', minDays: 730 },
];
export function ageDays(subscribedAt: Date | string | number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(subscribedAt).getTime()) / 86_400_000));
}
export function tierFor(subscribedAt: Date | string | number, now = Date.now()): Tier {
  const d = ageDays(subscribedAt, now);
  let t: Tier = 'hut';
  for (const x of TIERS) if (d >= x.minDays) t = x.tier;
  return t;
}

// ================================================================== the Moon (infinite, with the biomes of other worlds)
export const MOON_PAD = { x: 50, y: 80, r: 7 };      // landing pad / return rocket
export const MOON_CENTER = { x: 50, y: 62 };        // first habitats cluster here
export const LUNAR_MIN_DAYS = 365;                  // subscribers this old (or premium) move to the Moon
export const isColonist = (premium: boolean, days: number) => premium || days >= LUNAR_MIN_DAYS;

/** highlands: classic grey Moon; mare: dark basalt plains; mars: rust dust; europa: cracked ice;
 *  volcanic: black rock with lava rivers (Io); crystal: glowing crystal fields (alien). */
export type MoonBiome = 'highlands' | 'mare' | 'mars' | 'europa' | 'volcanic' | 'crystal';
export const MOON_BIOMES: MoonBiome[] = ['highlands', 'mare', 'mars', 'europa', 'volcanic', 'crystal'];
const moonHome = (x: number, y: number) => Math.hypot(x - MOON_CENTER.x, y - 70);
export function moonBiomeAt(x: number, y: number): MoonBiome {
  const near = 1 - smoothstep(34, 70, moonHome(x, y));
  const wx = x + (vnoise(x / 30, y / 30, 210) - 0.5) * 40, wy = y + (vnoise(x / 30, y / 30, 211) - 0.5) * 40;
  const t = fbm(wx, wy, 201, 110) * (1 - near) + 0.5 * near, w = fbm(wx, wy, 202, 100) * (1 - near) + 0.5 * near;
  if (t < 0.4) return w > 0.5 ? 'europa' : 'mare';
  if (t > 0.6) return w > 0.5 ? 'volcanic' : 'mars';
  if (w > 0.62) return 'crystal';
  return 'highlands';
}
export interface Crater { x: number; y: number; r: number }
const CRATER_CELL = 12;
export function cratersInCell(gx: number, gy: number): Crater[] {
  const out: Crater[] = [];
  const mareCalm = moonBiomeAt(gx * CRATER_CELL + 6, gy * CRATER_CELL + 6) === 'mare' ? 0.45 : 0;
  if (hash2(gx, gy, 120) > 0.62 - mareCalm) return out;
  const r = 1.6 + hash2(gx, gy, 121) * 4.8, x = gx * CRATER_CELL + 1 + hash2(gx, gy, 122) * 10, y = gy * CRATER_CELL + 1 + hash2(gx, gy, 123) * 10;
  if (Math.hypot(x - MOON_PAD.x, y - MOON_PAD.y) < r + 12) return out;
  if (Math.hypot(x - MOON_CENTER.x, y - MOON_CENTER.y) < r + 8) return out;
  out.push({ x, y, r });
  return out;
}
export function cratersNear(x0: number, y0: number, x1: number, y1: number): Crater[] {
  const out: Crater[] = [];
  for (let gy = Math.floor(y0 / CRATER_CELL) - 1; gy <= Math.floor(y1 / CRATER_CELL) + 1; gy++)
    for (let gx = Math.floor(x0 / CRATER_CELL) - 1; gx <= Math.floor(x1 / CRATER_CELL) + 1; gx++) out.push(...cratersInCell(gx, gy));
  return out;
}
export const inCrater = (x: number, y: number) => cratersNear(x, y, x, y).some((c) => Math.hypot(x - c.x, y - c.y) < c.r + 0.8);
/** Lava rivers in the volcanic biome. */
export const isLava = (x: number, y: number) => moonBiomeAt(x, y) === 'volcanic' && Math.abs(fbm(x, y, 230, 40) - 0.5) < 0.022;
export const moonBlocked = (x: number, y: number) =>
  inCrater(x, y) || isLava(x, y) || Math.hypot(x - MOON_PAD.x, y - MOON_PAD.y) < MOON_PAD.r + 3;
/** Upright features: 0 none, 1 boulder, 2 crystal cluster, 3 ice spire, 4 lava vent, 5 red mesa, 6 dark basalt column */
export function moonFeatureAt(x: number, y: number): number {
  if (Math.hypot(x - MOON_PAD.x, y - MOON_PAD.y) < MOON_PAD.r + 4 || isLava(x, y)) return 0;
  const b = moonBiomeAt(x, y), r = hash2(x, y, 240), k = hash2(x, y, 241);
  const p = b === 'crystal' ? 0.16 : b === 'europa' ? 0.1 : b === 'volcanic' ? 0.07 : b === 'mars' ? 0.06 : b === 'mare' ? 0.03 : 0.04;
  if (r > p || inCrater(x, y)) return 0;
  switch (b) {
    case 'crystal': return k < 0.8 ? 2 : 1;
    case 'europa': return k < 0.8 ? 3 : 1;
    case 'volcanic': return k < 0.45 ? 4 : k < 0.8 ? 6 : 1;
    case 'mars': return k < 0.35 ? 5 : 1;
    case 'mare': return k < 0.5 ? 6 : 1;
    default: return 1;
  }
}

export interface SubscriberDTO {
  id: number;
  name: string;
  subscribedAt: string;
  x: number;
  y: number;
  treeId: number;
  tier: Tier;
  ageDays: number;
  premium: boolean;
  /** Present when the subscriber lives on the Moon (premium or long-term). */
  moon: { x: number; y: number } | null;
}
