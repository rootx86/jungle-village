// Biome-specific houses: every biome has its own materials and shape (snow caps, adobe flat roofs,
// stilt huts in swamp and jungle, pagoda-pink tiles in the blossom grove, slate chalets in the mountains...).
import type { Biome, Tier } from '@shared';
import { mk, rect, type Cvs } from './art';

type Pal = [string, string, string, string]; // base, light, dark, stripe
interface Style {
  wall: [string, string];
  kind: 'planks' | 'bricks' | 'adobe' | 'bamboo' | 'logs';
  roof: Pal;
  door: string; win: string; chimney: string;
  flat?: boolean; stilts?: boolean; fringe?: boolean; awning?: boolean; snow?: boolean;
}

const STYLES: Record<Biome, Style> = {
  emerald:  { wall: ['#9a6b3a', '#74502a'], kind: 'planks', roof: ['#a8402f', '#c25a42', '#7c2c20', '#933626'], door: '#3a2314', win: '#f2c75c', chimney: '#5a4a42' },
  lime:     { wall: ['#b08a52', '#8a6a3a'], kind: 'planks', roof: ['#c9663a', '#e08650', '#9a4626', '#b45a30'], door: '#4a2f1a', win: '#ffe27a', chimney: '#6a5a4a' },
  golden:   { wall: ['#8a5a30', '#68421f'], kind: 'planks', roof: ['#d58a2a', '#efaa42', '#a8681a', '#bf7a22'], door: '#3a2314', win: '#ffd060', chimney: '#5a4034' },
  blossom:  { wall: ['#f2e6d8', '#d8c8b4'], kind: 'planks', roof: ['#d8689a', '#ee8ab4', '#a84a76', '#c45a88'], door: '#8a3a4a', win: '#ffe8a0', chimney: '#8a7a70' },
  blue:     { wall: ['#6b4a3a', '#4a3226'], kind: 'logs', roof: ['#2f7a86', '#46a0ac', '#1f5a64', '#388a96'], door: '#2a1a14', win: '#f6d36b', chimney: '#5a5a62' },
  snow:     { wall: ['#7a5238', '#583a28'], kind: 'logs', roof: ['#dce8f4', '#ffffff', '#a8bcd4', '#c4d4e6'], door: '#2a1a14', win: '#ffe08a', chimney: '#7a7a84', snow: true },
  desert:   { wall: ['#d9b27a', '#bf9660'], kind: 'adobe', roof: ['#c9955a', '#e0b078', '#9a6c3a', '#b4824a'], door: '#5a3a24', win: '#3a4a6a', chimney: '#b4824a', flat: true, awning: true },
  swamp:    { wall: ['#4a3a2c', '#33281e'], kind: 'planks', roof: ['#4f7040', '#6a9050', '#34502a', '#5a7c44'], door: '#1f160f', win: '#c8e07a', chimney: '#3a3a30', stilts: true },
  tropical: { wall: ['#cdb468', '#a89040'], kind: 'bamboo', roof: ['#4aa84a', '#6ccc5a', '#2f7a34', '#58b84a'], door: '#5a3a1a', win: '#fff0a0', chimney: '#8a7040', stilts: true, fringe: true },
  mountain: { wall: ['#8a8590', '#6a6570'], kind: 'bricks', roof: ['#4a5568', '#6a7a90', '#34404f', '#56627a'], door: '#3a2a22', win: '#f6d36b', chimney: '#6a6570' },
};

export const HOUSE_BASE: Record<Tier | 'site', [number, number]> = {
  hut: [32, 28], house: [32, 34], cottage: [36, 38], manor: [48, 46], site: [32, 28],
};
const STILT = 8;

function roofTri(g: CanvasRenderingContext2D, cx: number, y0: number, h: number, half: number, p: Pal, st: Style) {
  if (st.flat) { // flat adobe roof with a parapet lip
    const rows = Math.max(3, Math.round(h * 0.4));
    rect(g, cx - half, y0 + h - rows, half * 2, rows, p[0]);
    rect(g, cx - half, y0 + h - rows, half * 2, 2, p[1]);
    rect(g, cx - half, y0 + h - 1, half * 2, 1, p[2]);
    for (let x = cx - half; x < cx + half; x += 3) rect(g, x, y0 + h - rows - 1, 2, 1, p[1]);
    return;
  }
  for (let i = 0; i < h; i++) {
    let hw = Math.max(1, Math.round(1 + (half - 1) * (i / (h - 1))));
    if (st.fringe && i > h - 4) hw += i % 2;
    const y = y0 + i;
    rect(g, cx - hw, y, hw * 2, 1, i % 3 === 2 ? p[3] : p[0]);
    rect(g, cx - hw, y, 1, 1, p[1]); rect(g, cx + hw - 1, y, 1, 1, p[2]);
    if (i % 3 === 0) rect(g, cx - hw + 1, y, Math.max(0, hw - 1), 1, p[1]);
    if (st.snow && i < h * 0.6) { rect(g, cx - hw + 1, y, hw * 2 - 2, 1, i % 4 === 3 ? '#e4eef8' : '#ffffff'); }
  }
  if (st.snow) for (let x = cx - half + 2; x < cx + half - 2; x += 4) rect(g, x, y0 + h, 1, 2, '#e8f2fb'); // icicles
}
function walls(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, st: Style) {
  const [a, b] = st.wall;
  rect(g, x, y, w, h, a);
  if (st.kind === 'planks') for (let i = 2; i < w; i += 3) rect(g, x + i, y, 1, h, b);
  else if (st.kind === 'logs') for (let j = 2; j < h; j += 3) { rect(g, x, y + j, w, 1, b); rect(g, x, y + j - 1, 1, 1, a); }
  else if (st.kind === 'bamboo') { for (let i = 1; i < w; i += 3) rect(g, x + i, y, 1, h, b); for (let j = 4; j < h; j += 5) rect(g, x, y + j, w, 1, b); }
  else if (st.kind === 'adobe') { for (let i = 0; i < 9; i++) rect(g, x + 2 + ((i * 7) % (w - 4)), y + 2 + ((i * 5) % Math.max(1, h - 4)), 2, 1, b); rect(g, x, y + h - 2, w, 2, b); }
  else { // bricks
    for (let j = 2; j < h; j += 3) {
      rect(g, x, y + j, w, 1, b);
      for (let i = (j / 3) % 2 ? 2 : 5; i < w; i += 6) rect(g, x + i, y + j - 2, 1, 2, b);
    }
  }
}
const shadow = (g: CanvasRenderingContext2D, x: number, y: number, w: number) => rect(g, x, y, w, 2, 'rgba(0,0,0,0.35)');
function door(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, st: Style) {
  rect(g, x, y, w, h, st.door);
  if (st.flat) { rect(g, x, y, w, 1, st.wall[1]); rect(g, x + 1, y - 1, w - 2, 1, st.door); } // arch
}
function awning(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  for (let i = 0; i < w; i++) rect(g, x + i, y, 1, 2, i % 2 ? '#f4efe6' : '#c0392b');
}

function base(tier: Tier, st: Style): Cvs {
  const [w, h] = HOUSE_BASE[tier];
  const c = mk(w, h), g = c.getContext('2d')!;
  const R = st.roof;
  if (tier === 'hut') {
    shadow(g, 5, 26, 22);
    walls(g, 7, 15, 18, 11, st);
    door(g, 14, 19, 4, 7, st);
    roofTri(g, 16, 1, 15, 15, R, st);
  } else if (tier === 'house') {
    shadow(g, 3, 32, 26);
    if (!st.flat) rect(g, 22, 4, 3, 8, st.chimney);
    walls(g, 4, 17, 24, 15, st);
    door(g, 13, 22, 5, 10, st);
    rect(g, 6, 21, 5, 5, st.win); rect(g, 8, 21, 1, 5, st.wall[1]); rect(g, 6, 23, 5, 1, st.wall[1]);
    rect(g, 21, 21, 5, 5, st.win); rect(g, 23, 21, 1, 5, st.wall[1]);
    if (st.awning) awning(g, 12, 20, 7);
    roofTri(g, 16, 2, 16, 16, R, st);
  } else if (tier === 'cottage') {
    shadow(g, 2, 36, 32);
    if (!st.flat) { rect(g, 26, 3, 4, 10, st.chimney); rect(g, 26, 3, 4, 1, '#3a2a22'); }
    walls(g, 3, 28, 30, 9, { ...st, kind: st.kind === 'adobe' ? 'adobe' : 'bricks', wall: st.kind === 'adobe' ? st.wall : ['#8b8b8f', '#66666b'] });
    rect(g, 3, 17, 30, 11, st.kind === 'adobe' || st.kind === 'bamboo' ? st.wall[0] : '#e8dcb8');
    for (const x of [3, 17, 32]) rect(g, x, 17, 1, 11, '#5a3a22');
    rect(g, 3, 27, 30, 1, '#5a3a22');
    door(g, 15, 27, 6, 10, st);
    rect(g, 7, 20, 5, 5, st.win); rect(g, 24, 20, 5, 5, st.win);
    rect(g, 9, 20, 1, 5, '#5a3a22'); rect(g, 26, 20, 1, 5, '#5a3a22');
    if (st.awning) awning(g, 14, 25, 8);
    roofTri(g, 18, 0, 19, 18, R, st);
  } else {
    shadow(g, 1, 44, 46);
    walls(g, 1, 26, 15, 18, { ...st, kind: st.kind === 'adobe' ? 'adobe' : 'bricks', wall: st.kind === 'adobe' ? st.wall : ['#a39d94', '#7d776e'] });
    walls(g, 32, 26, 15, 18, { ...st, kind: st.kind === 'adobe' ? 'adobe' : 'bricks', wall: st.kind === 'adobe' ? st.wall : ['#a39d94', '#7d776e'] });
    roofTri(g, 8, 18, 9, 9, R, st); roofTri(g, 39, 18, 9, 9, R, st);
    walls(g, 14, 12, 20, 32, { ...st, kind: st.kind === 'adobe' ? 'adobe' : 'bricks', wall: st.kind === 'adobe' ? st.wall : ['#b8b2a6', '#8d877c'] });
    roofTri(g, 24, 0, 13, 12, R, st);
    if (st.flat) { for (let i = 0; i < 6; i++) rect(g, 24 - (6 - i), -0 + i + 0, (6 - i) * 2, 1, i % 2 ? R[1] : R[0]); rect(g, 24, 0, 1, 1, '#f4d060'); }
    rect(g, 23, 0, 1, 3, '#d8d8d8'); rect(g, 24, 0, 4, 2, '#d4a02f');
    rect(g, 21, 18, 6, 6, '#ffd870'); rect(g, 23, 18, 2, 6, '#6a5a3a');
    door(g, 20, 34, 8, 10, st);
    rect(g, 22, 38, 1, 1, '#e8c060');
    for (const [x, y] of [[4, 31], [10, 31], [35, 31], [41, 31], [17, 28], [29, 28]]) rect(g, x, y, 3, 4, st.win);
    rect(g, 0, 43, 48, 1, '#5a554d');
  }
  return c;
}

const cache = new Map<string, Cvs>();
export function houseSprite(tier: Tier, biome: Biome): Cvs {
  const key = `${tier}|${biome}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const st = STYLES[biome] ?? STYLES.emerald;
  let c = base(tier, st);
  if (st.stilts) { // lift the house on posts, ladder in front
    const lifted = mk(c.width, c.height + STILT), g = lifted.getContext('2d')!;
    g.drawImage(c, 0, 0);
    g.clearRect(0, c.height - 3, c.width, 3);
    const w = c.width;
    for (const x of [Math.round(w * 0.16), Math.round(w * 0.45), Math.round(w * 0.78)]) { rect(g, x, c.height - 3, 2, STILT + 3, '#4a3320'); rect(g, x, c.height - 3, 1, STILT + 3, '#6a4a30'); }
    rect(g, Math.round(w * 0.5), c.height - 2, 1, STILT + 2, '#7a5a38'); rect(g, Math.round(w * 0.5) + 3, c.height - 2, 1, STILT + 2, '#7a5a38');
    for (let y = c.height; y < c.height + STILT; y += 2) rect(g, Math.round(w * 0.5), y, 4, 1, '#8a6a42');
    rect(g, 2, c.height + STILT - 2, w - 4, 2, 'rgba(0,0,0,0.3)');
    c = lifted;
  }
  cache.set(key, c);
  return c;
}
export function houseDims(tier: Tier, biome: Biome): [number, number] {
  const [w, h] = HOUSE_BASE[tier];
  return [w, STYLES[biome]?.stilts ? h + STILT : h];
}
