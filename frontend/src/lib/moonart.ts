// Upright features of the other-world biomes on the Moon (boulders, crystals, ice spires, lava vents, mesas, basalt).
import { hash2 } from '@shared';
import { mk, rect, type Cvs } from './art';

const ctx = (c: Cvs) => c.getContext('2d')!;
const CRYSTAL = [['#4a2a8a', '#7a4ad8', '#b48aff', '#e8d8ff'], ['#0a5a7a', '#18a0cc', '#6ae0ff', '#d8f8ff'], ['#8a1a6a', '#d83aa8', '#ff8ae0', '#ffe0f8'], ['#1a7a4a', '#2ad88a', '#8affc4', '#e0fff0']];

/** kinds 1..6, see moonFeatureAt() in shared.ts; v = variant 0..3 */
export function moonFeatureSprite(kind: number, v: number): Cvs {
  const r = (i: number) => hash2(v, i, 900 + kind);
  switch (kind) {
    case 2: { // crystal cluster
      const c = mk(26, 36), g = ctx(c), pal = CRYSTAL[v % 4];
      rect(g, 2, 32, 22, 3, 'rgba(0,0,0,0.3)');
      const spires: Array<[number, number, number]> = [[13, 32, 28], [6, 33, 18], [20, 33, 20], [10, 33, 12], [17, 33, 10]];
      spires.forEach(([cx, base, h], i) => {
        const w = 3 + (i < 3 ? 1 : 0);
        for (let y = 0; y < h; y++) {
          const hw = y < 4 ? 1 + (y >> 1) : w;
          for (let x = -hw; x <= hw; x++) rect(g, cx + x, base - h + y, 1, 1, x < -hw / 3 ? pal[2] : x > hw / 3 ? pal[0] : pal[1]);
        }
        rect(g, cx - 1, base - h, 1, 2, pal[3]);
      });
      return c;
    }
    case 3: { // ice spire
      const c = mk(22, 42), g = ctx(c);
      rect(g, 2, 39, 18, 3, 'rgba(0,0,0,0.25)');
      for (let y = 0; y < 40; y++) {
        const hw = Math.max(1, Math.round(1 + y * 0.2 + (r(y) - 0.5)));
        for (let x = -hw; x <= hw; x++) rect(g, 11 + x - (y > 24 ? 0 : 0), y, 1, 1, x < -hw * 0.3 ? '#e4f6ff' : x > hw * 0.35 ? '#7ab0d8' : '#b4dcf4');
      }
      rect(g, 10, 0, 2, 3, '#ffffff'); rect(g, 8, 10, 1, 14, '#ffffff');
      return c;
    }
    case 4: { // lava vent
      const c = mk(30, 24), g = ctx(c);
      rect(g, 2, 21, 26, 3, 'rgba(0,0,0,0.35)');
      for (let y = 0; y < 20; y++) {
        const hw = Math.round(3 + y * 0.65);
        for (let x = -hw; x <= hw; x++) rect(g, 15 + x, 3 + y, 1, 1, x < 0 ? '#3a343c' : '#222026');
      }
      rect(g, 11, 2, 8, 3, '#ffb02e'); rect(g, 12, 1, 6, 2, '#fff0a0'); rect(g, 10, 4, 10, 2, '#ff5a1a');
      for (let i = 0; i < 6; i++) rect(g, 6 + Math.floor(r(i) * 18), 8 + Math.floor(r(i + 9) * 10), 1, 2, '#ff6a1a');
      return c;
    }
    case 5: { // red mesa
      const c = mk(42, 36), g = ctx(c);
      rect(g, 2, 33, 38, 3, 'rgba(0,0,0,0.3)');
      const top = 8 + Math.floor(r(1) * 5);
      for (let y = top; y < 33; y++) {
        const hw = Math.round(11 + (y - top) * 0.55 + (hash2(y, v, 910) - 0.5) * 2);
        for (let x = -hw; x <= hw; x++) {
          const strata = Math.floor((y + (x > 0 ? 2 : 0)) / 5) % 3;
          rect(g, 21 + x, y, 1, 1, x < hw * 0.2 ? ['#c4663a', '#b05a30', '#d07a48'][strata] : ['#8a3e24', '#7a3420', '#94482c'][strata]);
        }
      }
      rect(g, 10, top, 22, 2, '#e8905a');
      return c;
    }
    case 6: { // basalt columns
      const c = mk(24, 38), g = ctx(c);
      rect(g, 2, 35, 20, 3, 'rgba(0,0,0,0.35)');
      [[5, 22], [11, 32], [17, 26], [8, 14], [14, 18]].forEach(([cx, h], i) => {
        for (let y = 0; y < h; y++) { rect(g, cx - 2, 35 - h + y, 2, 1, '#4a4650'); rect(g, cx, 35 - h + y, 3, 1, '#2c2a32'); }
        rect(g, cx - 2, 35 - h, 5, 1, '#6a6670');
        if (i % 2) rect(g, cx - 1, 35 - h - 1, 3, 1, '#6a6670');
      });
      return c;
    }
    default: { // 1: boulder, tinted per variant
      const c = mk(20, 14), g = ctx(c);
      const tint = [['#8a8a96', '#6a6a76', '#a8a8b4'], ['#78787f', '#58585f', '#98989f'], ['#9a8a80', '#7a6a60', '#baa89c'], ['#6a6a78', '#4a4a58', '#8a8a98']][v % 4];
      rect(g, 2, 12, 16, 2, 'rgba(0,0,0,0.3)');
      for (let y = 0; y < 11; y++) {
        const hw = Math.round(8 * Math.sqrt(1 - ((y - 6) / 6.5) ** 2));
        for (let x = -hw; x <= hw; x++) rect(g, 10 + x, 2 + y, 1, 1, x < -hw * 0.2 && y < 6 ? tint[2] : x > hw * 0.3 ? tint[1] : tint[0]);
      }
      return c;
    }
  }
}
