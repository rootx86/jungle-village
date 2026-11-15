// Mountain peaks, the rocket launch complex and the Moon colony (procedural pixel art).
import { hash2, type Tier } from '@shared';
import { mk, rect, type Cvs } from './art';

const ctx = (c: Cvs) => c.getContext('2d')!;

// ---------------------------------------------------------------- mountains
export const PEAK_SIZE: Array<[number, number]> = [[60, 66], [92, 104], [128, 146]];
const ROCK_L = ['#a29dac', '#918c9c', '#807b8c'];
const ROCK_D = ['#6e6a7c', '#5f5b6e', '#504c60'];
const fbm = (x: number, v: number) => 0.5 * hash2(Math.floor(x / 5), v, 510) + 0.3 * hash2(Math.floor(x / 2.5), v, 511) + 0.2 * hash2(Math.floor(x), v, 512);

/** A real mountain: jagged silhouette from several overlapping ridges, lit from the left, snow cap, pine skirt. */
export function bigPeak(size: number, v: number): Cvs {
  const [W, H] = PEAK_SIZE[size];
  const c = mk(W, H), g = ctx(c);
  const r = (i: number) => hash2(v, i, 520 + size);
  const ridges = [
    { x: W * (0.4 + r(1) * 0.2), h: H * 0.97, w: W * 0.52 },
    { x: W * (0.15 + r(2) * 0.15), h: H * (0.55 + r(3) * 0.15), w: W * 0.34 },
    { x: W * (0.7 + r(4) * 0.15), h: H * (0.5 + r(5) * 0.2), w: W * 0.34 },
  ];
  const top = new Array<number>(W);
  for (let x = 0; x < W; x++) {
    let h = 0;
    for (const p of ridges) h = Math.max(h, p.h * Math.pow(Math.max(0, 1 - Math.abs(x - p.x) / p.w), 0.85));
    h += (fbm(x, v) - 0.5) * H * 0.1 * (h / H);
    top[x] = H - Math.max(0, h);
  }
  const snowLine = H * (0.5 - 0.02 * size);
  for (let x = 0; x < W; x++) {
    const sl = top[Math.max(0, x - 1)] - top[Math.min(W - 1, x + 1)]; // > 0: rising to the right = left face = lit
    const lit = sl > 0.2 || (Math.abs(sl) <= 0.2 && x < W * 0.45);
    for (let y = Math.floor(top[x]); y < H; y++) {
      const f = 1 - y / H;                                   // 1 = summit
      if (f < 0.2 && hash2(x, y, 540 + v) < (0.2 - f) / 0.2 * 0.92) continue; // dissolve into the ground
      const depth = y - top[x];
      const jag = (hash2(x, y, 530 + v) - 0.5) * H * 0.07;
      let col: string;
      const streak = hash2(x >> 1, v, 531) > 0.7 ? 1 : 0;
      if (y < snowLine + jag + (lit ? 0 : -H * 0.04) && f > 0.4) {
        col = lit ? (streak ? '#e9f1fa' : '#f9fbff') : streak ? '#9db1d0' : '#b7c8e0';
        if (depth < 1.5) col = lit ? '#ffffff' : '#c8d6ea';
      } else {
        const k = (Math.floor(hash2(x, y >> 1, 532 + v) * 3) + streak) % 3;
        col = lit ? ROCK_L[k] : ROCK_D[k];
        if (hash2(x >> 1, y >> 2, 533 + v) > 0.88) col = lit ? ROCK_D[0] : '#3e3a4e';           // cracks and strata
        if (y % 11 === 0 && hash2(x, y, 534) > 0.5) col = lit ? ROCK_D[1] : '#46425a';
        if (depth < 1.2) col = lit ? '#cfc9d8' : '#4a465c';                                    // rim light
        if (f < 0.26 && hash2(x >> 1, y >> 1, 535 + v) > 0.4) col = hash2(x, y, 537) > 0.5 ? (lit ? '#3f6a42' : '#2c4c34') : (lit ? '#52805a' : '#365a40'); // pine skirt
        else if (f < 0.36 && hash2(x, y, 536) > 0.7) col = lit ? '#4a7a4c' : '#34583c';
      }
      rect(g, x, y, 1, 1, col);
    }
  }
  // tiny pines at the foot
  for (let i = 0; i < Math.floor(W / 7); i++) {
    const x = Math.floor(r(10 + i) * (W - 6)) + 3, y = H - 2 - Math.floor(r(30 + i) * 4);
    rect(g, x, y - 3, 1, 3, '#244a30'); rect(g, x - 1, y - 2, 3, 1, '#2f5a38'); rect(g, x, y - 4, 1, 1, '#3a6a40');
  }
  return c;
}

// ---------------------------------------------------------------- launch complex
export function rocketSprite(): Cvs {
  const c = mk(24, 64), g = ctx(c);
  rect(g, 7, 12, 10, 40, '#f2f4f8');
  rect(g, 7, 12, 3, 40, '#ffffff'); rect(g, 14, 12, 3, 40, '#c8cfda');
  for (let i = 0; i < 12; i++) { const hw = Math.max(1, Math.round(5 * Math.sqrt(1 - i / 12))); rect(g, 12 - hw, i, hw * 2, 1, i < 4 ? '#e04a3a' : '#c0392b'); }
  rect(g, 8, 9, 8, 3, '#c0392b');
  rect(g, 7, 22, 10, 2, '#2a3a5a'); rect(g, 7, 34, 10, 2, '#2a3a5a');
  rect(g, 9, 26, 6, 6, '#5ab4f0'); rect(g, 10, 27, 2, 2, '#c8ecff'); rect(g, 9, 26, 6, 1, '#2a3a5a'); rect(g, 9, 31, 6, 1, '#2a3a5a');
  rect(g, 4, 40, 3, 14, '#c0392b'); rect(g, 17, 40, 3, 14, '#c0392b'); rect(g, 3, 50, 1, 4, '#c0392b'); rect(g, 20, 50, 1, 4, '#c0392b');
  rect(g, 8, 52, 8, 3, '#7a808a'); rect(g, 9, 55, 6, 2, '#4a4e58');
  return c;
}
export function flameSprite2(frame: number): Cvs {
  const c = mk(20, 40), g = ctx(c);
  const len = [26, 34, 30][frame % 3];
  for (let i = 0; i < len; i++) {
    const w = Math.max(1, Math.round(9 * (1 - i / len) + (frame % 2 ? 1 : 0)));
    rect(g, 10 - w, i, w * 2, 1, i < len * 0.25 ? '#fffbe0' : i < len * 0.55 ? '#ffc23a' : '#ff6a1a');
  }
  return c;
}
export function gantrySprite(): Cvs {
  // a timber scaffold with rope ladders: no steel, no modern parts
  const c = mk(30, 84), g = ctx(c);
  rect(g, 2, 80, 26, 4, 'rgba(0,0,0,0.3)');
  for (const x of [4, 22]) { rect(g, x, 4, 3, 78, '#7a5230'); rect(g, x, 4, 1, 78, '#9a6a3a'); }
  for (let y = 6; y < 80; y += 8) {
    rect(g, 4, y, 21, 2, '#6a4424');
    for (let i = 0; i < 8; i++) { rect(g, 6 + i * 2, y + i, 2, 1, '#8a5a30'); rect(g, 22 - i * 2, y + i, 2, 1, '#8a5a30'); }
    rect(g, 3, y - 1, 3, 1, '#c8b890'); rect(g, 21, y - 1, 3, 1, '#c8b890'); // rope lashings
  }
  rect(g, 0, 24, 6, 3, '#6a4424'); rect(g, 0, 50, 6, 3, '#6a4424');
  rect(g, 10, 0, 2, 6, '#5a3a22'); rect(g, 10, 0, 7, 3, '#c0392b'); // a cloth pennant
  return c;
}
export function tankSprite(): Cvs {
  // stacked wooden barrels (fuel, gunpowder and water, the old way)
  const c = mk(24, 36), g = ctx(c);
  rect(g, 1, 33, 22, 3, 'rgba(0,0,0,0.3)');
  const barrel = (x: number, y: number) => {
    rect(g, x, y + 1, 10, 12, '#8a5a30'); rect(g, x + 1, y, 8, 14, '#8a5a30');
    for (let i = 2; i < 10; i += 3) rect(g, x + i, y, 1, 14, '#6a4424');
    rect(g, x, y + 3, 10, 1, '#3a3a40'); rect(g, x, y + 10, 10, 1, '#3a3a40'); rect(g, x + 1, y, 3, 1, '#b08a58');
  };
  barrel(1, 21); barrel(12, 21); barrel(6, 8);
  return c;
}
export function controlBuilding(): Cvs {
  // a stone watchtower with a timber roof for the launch master
  const c = mk(52, 34), g = ctx(c);
  rect(g, 2, 31, 48, 3, 'rgba(0,0,0,0.3)');
  for (let y = 12; y < 32; y += 3) { rect(g, 6, y, 40, 3, y % 6 === 0 ? '#8a8680' : '#7a7670'); for (let x = (y % 6 ? 8 : 12); x < 44; x += 8) rect(g, x, y, 1, 3, '#5a5650'); }
  for (let i = 0; i < 12; i++) { const hw = 6 + i * 2; rect(g, 26 - hw, i, hw * 2, 1, i % 3 === 2 ? '#5a3a24' : '#7a4a2e'); }
  rect(g, 21, 20, 10, 12, '#4a2e1a'); rect(g, 22, 22, 8, 1, '#2a1a10');
  rect(g, 10, 17, 4, 6, '#1a1a22'); rect(g, 38, 17, 4, 6, '#1a1a22'); rect(g, 11, 17, 2, 1, '#e8c060');
  return c;
}

// ---------------------------------------------------------------- moon base art
export function habitatSprite(tier: Tier): Cvs {
  const [w, h] = { hut: [30, 26], house: [36, 30], cottage: [40, 34], manor: [52, 44] }[tier];
  const c = mk(w, h), g = ctx(c);
  rect(g, 2, h - 3, w - 4, 3, 'rgba(0,0,0,0.4)');
  const dome = (cx: number, cy: number, r: number, glass: boolean) => {
    for (let y = -r; y <= 0; y++) {
      const hw = Math.round(Math.sqrt(r * r - y * y));
      for (let x = -hw; x < hw; x++) {
        const lit = x < 0;
        rect(g, cx + x, cy + y, 1, 1, glass ? (lit ? '#b8dcf4' : '#7aa8cc') : lit ? '#f2f4f8' : '#c4cad6');
      }
    }
  };
  if (tier === 'hut') { // sleeping pod
    rect(g, 4, 10, 22, 13, '#e8ecf2'); rect(g, 4, 10, 22, 2, '#ffffff'); rect(g, 4, 21, 22, 2, '#9aa0aa');
    dome(15, 10, 11, false); rect(g, 11, 12, 8, 6, '#26344f'); rect(g, 12, 13, 3, 1, '#7ab8f0');
    rect(g, 24, 4, 1, 8, '#9aa0aa'); rect(g, 23, 3, 3, 1, '#e04a3a');
  } else if (tier === 'house') { // module with solar wing
    rect(g, 6, 12, 24, 15, '#e8ecf2'); rect(g, 6, 12, 24, 2, '#ffffff'); rect(g, 6, 25, 24, 2, '#9aa0aa');
    for (let x = 9; x < 28; x += 6) { rect(g, x, 16, 4, 5, '#26344f'); rect(g, x, 16, 4, 1, '#7ab8f0'); }
    rect(g, 14, 22, 8, 5, '#5a6272'); rect(g, 0, 8, 7, 8, '#2a3f78'); rect(g, 0, 8, 7, 1, '#6a8ae0'); rect(g, 3, 8, 1, 8, '#6a8ae0');
    rect(g, 30, 6, 5, 8, '#2a3f78'); rect(g, 30, 6, 5, 1, '#6a8ae0');
  } else if (tier === 'cottage') { // glass dome
    rect(g, 4, 20, 32, 10, '#d4d8e0'); rect(g, 4, 20, 32, 2, '#f4f6fa'); rect(g, 4, 28, 32, 2, '#8a909c');
    dome(20, 20, 16, true);
    for (let i = 0; i < 6; i++) rect(g, 10 + i * 4, 10 + Math.abs(2 - (i % 3)), 1, 10, 'rgba(255,255,255,0.35)');
    rect(g, 16, 22, 8, 8, '#3a4252'); rect(g, 17, 14, 6, 6, '#ffd870');
    rect(g, 18, 3, 1, 6, '#9aa0aa'); rect(g, 17, 2, 3, 1, '#e04a3a');
  } else { // tower dome
    rect(g, 2, 26, 48, 16, '#d4d8e0'); rect(g, 2, 26, 48, 2, '#f4f6fa'); rect(g, 2, 40, 48, 2, '#8a909c');
    dome(14, 26, 12, true); dome(38, 26, 12, true);
    rect(g, 19, 6, 14, 36, '#e4e8ee'); rect(g, 19, 6, 14, 2, '#ffffff'); rect(g, 29, 6, 4, 36, '#b8c0cc');
    dome(26, 8, 8, true);
    for (let y = 14; y < 38; y += 8) { rect(g, 21, y, 4, 4, '#ffd870'); rect(g, 27, y, 4, 4, '#ffd870'); }
    rect(g, 25, 36, 2, 6, '#3a4252'); rect(g, 25, 0, 1, 4, '#9aa0aa'); rect(g, 26, 0, 4, 2, '#e04a3a');
    rect(g, 21, 30, 10, 12, '#3a4252');
  }
  return c;
}
export function solarArray(): Cvs {
  const c = mk(40, 22), g = ctx(c);
  for (let i = 0; i < 4; i++) { rect(g, 2 + i * 9, 4, 8, 14, '#24397a'); rect(g, 2 + i * 9, 4, 8, 1, '#7a9af0'); for (let k = 4; k < 18; k += 4) rect(g, 2 + i * 9, k, 8, 1, '#3a5aa8'); rect(g, 5 + i * 9, 18, 2, 3, '#9aa0aa'); }
  return c;
}
export function dishSprite(): Cvs {
  const c = mk(30, 32), g = ctx(c);
  rect(g, 13, 14, 4, 16, '#9aa0aa'); rect(g, 8, 28, 14, 3, '#7a808a');
  for (let i = 0; i < 10; i++) { const w = 4 + i * 2; rect(g, 15 - w / 2, 4 + i, w, 1, i < 3 ? '#f4f6fa' : i < 7 ? '#d8dce4' : '#a8b0bc'); }
  rect(g, 14, 0, 2, 8, '#9aa0aa'); rect(g, 13, 0, 4, 2, '#e04a3a');
  return c;
}
export function flagSprite(): Cvs {
  const c = mk(20, 30), g = ctx(c);
  rect(g, 3, 2, 1, 28, '#e8e8e8'); rect(g, 4, 3, 14, 9, '#f4f4f4');
  for (let i = 0; i < 9; i += 2) rect(g, 4, 3 + i, 14, 1, '#d8342c');
  rect(g, 4, 3, 6, 5, '#2a3f78'); for (let i = 0; i < 3; i++) rect(g, 5 + i * 2, 4 + (i % 2) * 2, 1, 1, '#ffffff');
  rect(g, 1, 29, 6, 1, 'rgba(0,0,0,0.4)');
  return c;
}
export function roverSprite(frame: number): Cvs {
  const c = mk(30, 18), g = ctx(c);
  rect(g, 4, 14, 22, 2, 'rgba(0,0,0,0.35)');
  rect(g, 6, 5, 18, 7, '#e8ecf2'); rect(g, 6, 5, 18, 1, '#ffffff'); rect(g, 8, 6, 6, 4, '#26344f');
  rect(g, 16, 1, 1, 5, '#9aa0aa'); rect(g, 14, 0, 5, 2, '#d8dce4');
  for (const x of [5, 13, 21]) { rect(g, x, 11, 5, 5, '#3a3e48'); rect(g, x + 1, 12 + (frame % 2), 3, 1, '#7a808a'); }
  return c;
}
