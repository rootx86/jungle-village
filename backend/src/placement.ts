import {
  CENTER, MOON_CENTER, MOON_PAD, OPEN_BUILD, treeAt, isBlocked, yardTiles, clearingDist, moonBlocked, biomeAt, moonBiomeAt,
} from './shared.js';

export interface Pos { x: number; y: number }
/** Houses are spread out like real homesteads: at least MIN_DIST tiles between centres (a tile is 16 px). */
export const MIN_DIST = 9;
export const NEIGHBOUR_R = 19; // radius (tiles) inside which neighbours are counted
export const MAX_NEIGHBOURS = 5;
const LINK = 17;               // houses closer than this belong to the same settlement

/** Describes one world (Earth or Moon) to the generic site chooser. */
export interface SiteCtx {
  center: Pos;
  /** is a house centred on (x, y) allowed here, ignoring other houses */
  ok: (x: number, y: number) => boolean;
  /** coarse region name, used to found new hamlets in under-populated regions */
  zone: (x: number, y: number) => string;
  zones: string[];
}

export const EARTH: SiteCtx = {
  center: CENTER,
  ok: (x, y) => {
    if (clearingDist(x, y) < 9.5) return false;
    if (yardTiles(x, y).some(([tx, ty]) => isBlocked(tx, ty))) return false;
    // normally there must be a tree to chop; sparse biomes (desert, snow...) allow open ground
    return treeAt(x, y) > 0 || OPEN_BUILD.includes(biomeAt(x, y));
  },
  zone: (x, y) => biomeAt(x, y),
  zones: ['emerald', 'desert', 'snow', 'tropical', 'swamp', 'golden', 'blue', 'blossom', 'mountain', 'lime'],
};
export const MOON: SiteCtx = {
  center: MOON_CENTER,
  ok: (x, y) => !yardTiles(x, y).some(([tx, ty]) => moonBlocked(tx, ty)) && Math.hypot(x - MOON_PAD.x, y - MOON_PAD.y) > MOON_PAD.r + 6,
  zone: (x, y) => moonBiomeAt(x, y),
  zones: ['highlands', 'mars', 'europa', 'volcanic', 'crystal', 'mare'],
};

class Grid {
  private cells = new Map<string, Pos[]>();
  constructor(houses: Pos[], private size = 16) { for (const h of houses) this.add(h); }
  private key(cx: number, cy: number) { return `${cx},${cy}`; }
  add(h: Pos) {
    const k = this.key(Math.floor(h.x / this.size), Math.floor(h.y / this.size));
    (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(h);
  }
  near(x: number, y: number, r: number): Pos[] {
    const out: Pos[] = [];
    const c0 = Math.floor((x - r) / this.size), c1 = Math.floor((x + r) / this.size), r0 = Math.floor((y - r) / this.size), r1 = Math.floor((y + r) / this.size);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) for (const h of this.cells.get(this.key(cx, cy)) ?? []) out.push(h);
    return out;
  }
}

/** Groups houses into settlements (single-link clustering with LINK tiles). */
function clusters(houses: Pos[], grid: Grid): Pos[][] {
  const seen = new Set<Pos>(), out: Pos[][] = [];
  for (const h of houses) {
    if (seen.has(h)) continue;
    const group: Pos[] = [], stack = [h];
    seen.add(h);
    while (stack.length) {
      const p = stack.pop()!;
      group.push(p);
      for (const q of grid.near(p.x, p.y, LINK)) if (!seen.has(q) && Math.hypot(q.x - p.x, q.y - p.y) <= LINK) { seen.add(q); stack.push(q); }
    }
    out.push(group);
  }
  return out;
}

/**
 * Settlement growth. Houses are far apart, grouped into villages of a few homes. A new house either
 * (a) grows an existing small hamlet, (b) grows a bigger settlement, or (c) founds a NEW hamlet in the
 * least populated region (desert, snow, jungle... on the Moon: Mars dust, ice, lava fields...), so people
 * end up living in every biome. Each house needs min(3, neighbours-in-hamlet) neighbours within NEIGHBOUR_R.
 */
export function chooseSiteIn(ctx: SiteCtx, houses: Pos[], rng: () => number = Math.random): Pos {
  const n = houses.length;
  const grid = new Grid(houses);
  const free = (x: number, y: number) => grid.near(x, y, MIN_DIST).every((h) => Math.max(Math.abs(h.x - x), Math.abs(h.y - y)) >= MIN_DIST);
  const valid = (x: number, y: number) => free(x, y) && ctx.ok(x, y);
  const neigh = (x: number, y: number) => grid.near(x, y, NEIGHBOUR_R).filter((h) => Math.hypot(h.x - x, h.y - y) <= NEIGHBOUR_R).length;

  const tryNear = (anchor: Pos, minD: number, maxD: number, tries: number, want: (x: number, y: number) => boolean): Pos | null => {
    for (let i = 0; i < tries; i++) {
      const a = rng() * Math.PI * 2, d = minD + rng() * (maxD - minD);
      const x = Math.round(anchor.x + Math.cos(a) * d), y = Math.round(anchor.y + Math.sin(a) * d);
      if (valid(x, y) && want(x, y)) return { x, y };
    }
    return null;
  };

  if (n === 0) {
    const s = tryNear(ctx.center, 12, 24, 4000, () => true);
    if (s) return s;
  } else {
    const groups = clusters(houses, grid);
    const small = groups.filter((g) => g.length < 5);
    const hamlets = groups.length;
    const mayFound = n >= 8 && hamlets < 3 + Math.floor(Math.sqrt(n) * 0.9);
    const roll = rng();

    // (c) found a new hamlet in the emptiest region
    if (mayFound && (roll < 0.22 || (small.length === 0 && roll < 0.6))) {
      const count = new Map<string, number>(ctx.zones.map((z) => [z, 0]));
      for (const h of houses) count.set(ctx.zone(h.x, h.y), (count.get(ctx.zone(h.x, h.y)) ?? 0) + 1);
      const order = [...ctx.zones].sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0) + (rng() - 0.5) * 0.8);
      for (const target of order) {
        for (let i = 0; i < 700; i++) {
          const base = houses[Math.floor(rng() * n)];
          const a = rng() * Math.PI * 2, d = 36 + rng() * 120;
          const x = Math.round(base.x + Math.cos(a) * d), y = Math.round(base.y + Math.sin(a) * d);
          if (ctx.zone(x, y) !== target || !valid(x, y)) continue;
          if (grid.near(x, y, 28).length > 0) continue; // genuinely remote
          return { x, y };
        }
      }
    }
    // (a)/(b) grow a settlement
    const pool = small.length && roll < 0.8 ? small : groups;
    const weights = pool.map((g) => (pool === small ? 1 / g.length : Math.pow(g.length, 0.7)));
    let r = rng() * weights.reduce((s, w) => s + w, 0), pick = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { pick = pool[i]; break; } }
    const need = Math.min(3, pick.length);
    const cx = pick.reduce((s, h) => s + h.x, 0) / pick.length, cy = pick.reduce((s, h) => s + h.y, 0) / pick.length;
    for (let stage = 0; stage < 5; stage++) {
      let best: Pos | null = null, bestScore = Infinity;
      for (let i = 0; i < 500; i++) {
        const anchor = pick[Math.floor(rng() * pick.length)];
        const a = rng() * Math.PI * 2, d = MIN_DIST + rng() * (7 + stage * 4);
        const x = Math.round(anchor.x + Math.cos(a) * d), y = Math.round(anchor.y + Math.sin(a) * d);
        if (!valid(x, y)) continue;
        const nb = neigh(x, y);
        if (nb < Math.max(1, need - Math.floor(stage / 2)) || nb > MAX_NEIGHBOURS + stage) continue;
        const score = Math.abs(nb - 3) * 2 + Math.hypot(x - cx, y - cy) * 0.35 + rng() * 3; // gentle compactness
        if (score < bestScore) { best = { x, y }; bestScore = score; }
      }
      if (best) return best;
    }
  }
  // last resort: anywhere valid near the centre, ever further out
  for (let ring = 20; ring < 600; ring += 20) {
    const s = tryNear(ctx.center, ring - 20, ring + 20, 400, () => true);
    if (s) return s;
  }
  throw new Error('No valid house site found');
}

export const chooseSite = (houses: Pos[], rng?: () => number) => chooseSiteIn(EARTH, houses, rng);
export const chooseMoonSite = (houses: Pos[], rng?: () => number) => chooseSiteIn(MOON, houses, rng);
