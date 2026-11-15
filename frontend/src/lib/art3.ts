// Trees and ground decoration for the snow, desert, swamp and tropical biomes.
import { hash2 } from '@shared';
import { mk, rect, pine, type Cvs } from './art';

const ctx = (c: Cvs) => c.getContext('2d')!;

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) rect(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, col);
}

/** kinds 10..17, see treeAt() in shared.ts */
export function extraTreeSprite(kind: number, v: number): Cvs {
  switch (kind) {
    case 10: return pine(v, ['#2c4f56', '#3d6f73', '#e2edf6', '#ffffff'], '#4a3a32'); // snow pine
    case 11: { // frosted bare tree
      const c = mk(18, 24), g = ctx(c);
      rect(g, 8, 8, 2, 16, '#6a584e'); rect(g, 8, 8, 1, 16, '#82706a');
      for (const [x, y, dx, dy] of [[8, 15, -6, -5], [9, 12, 6, -6], [8, 9, -4, -6], [9, 18, 5, -4]]) {
        line(g, x, y, x + dx, y + dy, '#6a584e'); rect(g, x + dx, y + dy, 2, 1, '#ffffff'); rect(g, x + dx / 2, y + dy / 2 - 1, 1, 1, '#e8f4ff');
      }
      rect(g, 7, 7, 4, 2, '#ffffff');
      return c;
    }
    case 12: { // cactus
      const c = mk(14, 22), g = ctx(c);
      rect(g, 5, 4, 4, 18, '#2f7a3a'); rect(g, 5, 4, 1, 18, '#58b85a'); rect(g, 8, 4, 1, 18, '#236a30');
      rect(g, 1, 10, 4, 3, '#2f7a3a'); rect(g, 1, 6, 3, 5, '#2f7a3a'); rect(g, 1, 6, 1, 5, '#58b85a');
      rect(g, 9, 12, 4, 3, '#2f7a3a'); rect(g, 10, 8, 3, 5, '#2f7a3a'); rect(g, 12, 8, 1, 5, '#236a30');
      for (let i = 0; i < 8; i++) rect(g, 5 + (i % 2) * 3, 5 + i * 2, 1, 1, '#f0f4d8');
      if (v % 2) rect(g, 6, 2, 3, 3, '#ff5a8a');
      return c;
    }
    case 13: { // palm
      const c = mk(28, 34), g = ctx(c);
      for (let y = 12; y < 34; y++) {
        const x = 13 + Math.round(Math.sin((34 - y) / 6) * 2);
        rect(g, x, y, 3, 1, y % 3 ? '#8a5a30' : '#6a4222');
      }
      const cx = 14, cy = 11;
      for (const a of [-170, -145, -115, -65, -35, -10]) {
        const r = (a * Math.PI) / 180;
        for (let t = 0; t < 12; t++) {
          const x = cx + Math.cos(r) * t * 1.2, y = cy + Math.sin(r) * t * 0.85 + t * t * 0.045;
          rect(g, Math.round(x), Math.round(y), 2, 2, t % 3 ? '#2f9a3f' : '#58c256');
          if (t > 3) rect(g, Math.round(x), Math.round(y) + 2, 1, 1, '#1f7a30');
        }
      }
      rect(g, 13, 12, 2, 2, '#5a3a1a'); rect(g, 16, 12, 2, 2, '#5a3a1a');
      return c;
    }
    case 14: { // acacia
      const c = mk(28, 22), g = ctx(c);
      rect(g, 13, 10, 2, 12, '#6a4a30'); rect(g, 10, 9, 2, 3, '#6a4a30'); rect(g, 16, 8, 2, 3, '#6a4a30');
      for (let y = 0; y < 9; y++) {
        const hw = Math.round(13 * Math.sqrt(Math.max(0, 1 - ((y - 4) / 5) ** 2)));
        for (let x = 14 - hw; x < 14 + hw; x++) rect(g, x, y + 1, 1, 1, y < 3 ? '#b4c250' : y < 6 ? '#86a636' : '#5e7e2a');
      }
      return c;
    }
    case 15: { // willow with hanging vines
      const c = mk(24, 30), g = ctx(c);
      rect(g, 10, 16, 3, 14, '#4a3a2a'); rect(g, 8, 28, 2, 2, '#4a3a2a'); rect(g, 13, 28, 2, 2, '#4a3a2a');
      const pal = ['#1f4a2a', '#2a6034', '#3a7a42', '#52964e'];
      for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) {
        if ((x - 12) ** 2 + (y - 9) ** 2 > 64) continue;
        const l = (12 - x + 9 - y) * 0.07 + (hash2(x + v * 9, y, 700) - 0.5) * 0.7;
        rect(g, x, y, 1, 1, pal[l > 0.5 ? 3 : l > 0.05 ? 2 : l > -0.4 ? 1 : 0]);
      }
      for (let x = 4; x < 21; x += 2) {
        const len = 6 + Math.floor(hash2(x, v, 701) * 9);
        rect(g, x, 12, 1, len, '#3a7a42'); rect(g, x, 12 + len - 2, 1, 2, '#52964e');
      }
      return c;
    }
    case 16: { // broadleaf / banana
      const c = mk(24, 28), g = ctx(c);
      rect(g, 11, 14, 2, 14, '#7a5a3a');
      for (const a of [-165, -130, -95, -60, -25]) {
        const r = (a * Math.PI) / 180, len = 11 + (hash2(a, v, 702) * 3 | 0);
        for (let t = 2; t < len; t++) {
          const w = Math.max(1, Math.round(3 - Math.abs(t - len * 0.45) * 0.22));
          const x = 12 + Math.cos(r) * t, y = 13 + Math.sin(r) * t * 0.9 + t * 0.12;
          rect(g, Math.round(x) - 1, Math.round(y), w + 1, w, t % 2 ? '#2fb04a' : '#5ad06a');
          rect(g, Math.round(x), Math.round(y), 1, 1, '#1a7a30');
        }
      }
      return c;
    }
    default: { // 17: dead tree
      const c = mk(18, 24), g = ctx(c);
      rect(g, 7, 6, 3, 18, '#5a4e46'); rect(g, 7, 6, 1, 18, '#7a6a5e');
      line(g, 8, 12, 2, 7, '#5a4e46', 2); line(g, 9, 10, 15, 4, '#5a4e46', 2); line(g, 8, 17, 14, 13, '#5a4e46'); line(g, 8, 8, 6, 2, '#5a4e46');
      return c;
    }
  }
}

/** decor kinds 7..11 */
export function extraDecor(kind: number, seed: number): Cvs {
  const c = mk(16, 16), g = ctx(c);
  const r = (i: number) => hash2(seed, i, 800);
  if (kind === 7) { // ice crystals
    for (let i = 0; i < 2; i++) {
      const x = 3 + Math.floor(r(i) * 9), y = 6 + Math.floor(r(i + 4) * 8);
      rect(g, x, y, 2, 6, '#bfe6ff'); rect(g, x - 1, y + 2, 4, 2, '#e8f6ff'); rect(g, x, y - 1, 1, 1, '#ffffff');
    }
  } else if (kind === 8) { // dry bush
    const cx = 8, cy = 11;
    for (let i = 0; i < 26; i++) {
      const a = r(i) * 6.28, d = r(i + 30) * 5;
      rect(g, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), 1, 1, i % 2 ? '#8a6a3a' : '#b0884a');
    }
  } else if (kind === 9) { // cattails
    for (let i = 0; i < 3; i++) {
      const x = 3 + Math.floor(r(i) * 10);
      rect(g, x, 5, 1, 10, '#5a7a3a'); rect(g, x - 1, 3, 3, 4, '#6a3a1a'); rect(g, x, 2, 1, 2, '#8a6a3a');
    }
  } else if (kind === 10) { // hibiscus
    for (let i = 0; i < 2; i++) {
      const x = 4 + Math.floor(r(i) * 8), y = 5 + Math.floor(r(i + 5) * 8), col = i ? '#ff5a8a' : '#ff3a3a';
      rect(g, x - 1, y + 2, 4, 2, '#2f8a3a'); rect(g, x - 1, y, 4, 3, col); rect(g, x, y - 1, 2, 5, col); rect(g, x, y + 1, 1, 1, '#ffe050');
    }
  } else { // 11: bones
    const x = 3 + Math.floor(r(1) * 5), y = 8 + Math.floor(r(2) * 4);
    rect(g, x, y, 5, 4, '#ece6d4'); rect(g, x + 1, y + 1, 1, 1, '#3a2a1a'); rect(g, x + 3, y + 1, 1, 1, '#3a2a1a');
    rect(g, x + 6, y + 2, 5, 1, '#ece6d4'); rect(g, x + 7, y, 1, 4, '#d4ceba'); rect(g, x + 9, y, 1, 4, '#d4ceba');
  }
  return c;
}
