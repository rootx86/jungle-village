// Mountains and farmland art (procedural, same conventions as art.ts).
import { hash2, type Crop } from '@shared';
import { mk, rect, type Cvs } from './art';

// ---------------------------------------------------------------- mountains
const ROCK_L = ['#9a95a0', '#8b8690', '#7c7782'];
const ROCK_D = ['#6a6573', '#5c5766', '#4e4a58'];
const SNOW_L = '#f7fafd', SNOW_M = '#dde7f2', SNOW_D = '#b4c4dc';

/** kind 1 = rocky hill (32x30), 2 = snow-capped peak (48x58). v = variant seed. */
export function peakSprite(kind: number, v: number): Cvs {
  const W = kind === 2 ? 48 : 32, H = kind === 2 ? 58 : 30;
  const c = mk(W, H), g = c.getContext('2d')!;
  const cx = W / 2, apexJag = Math.floor(hash2(v, 1, 500) * 5) - 2;
  const ridge = (i: number) => cx + apexJag * 0.4 + (hash2(v, i >> 2, 501) - 0.5) * 3 + i * 0.1;
  const snowLine = kind === 2 ? H * 0.44 : -1;
  for (let i = 0; i < H; i++) {
    const t = i / (H - 1);
    const hw = Math.max(1, Math.round(1 + (W / 2 - 1) * Math.pow(t, 0.86) + (hash2(v, i, 502) - 0.5) * 2.2));
    const rx = ridge(i);
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const lit = x < rx;
      const edge = x === Math.round(cx - hw) || x === Math.round(cx + hw) - 1;
      const sl = snowLine + (hash2(x, v, 503) - 0.5) * 7 + (x - cx) * 0.12 * (hash2(v, 7, 504) - 0.5);
      let col: string;
      if (i < sl) col = edge ? SNOW_D : lit ? SNOW_L : SNOW_M;
      else {
        const k = Math.floor(hash2(x, i + v * 13, 505) * 3);
        col = lit ? ROCK_L[k] : ROCK_D[k];
        if (hash2(x, i, 506) > 0.93) col = lit ? ROCK_D[0] : '#403c4a'; // cracks
        if (i > H * 0.78 && hash2(x, i, 507) > 0.55) col = lit ? '#5f7a4a' : '#43603a'; // alpine grass at the foot
        if (edge) col = '#3d3948';
      }
      rect(g, x, i, 1, 1, col);
    }
  }
  return c;
}

// ---------------------------------------------------------------- farm buildings and props
export function barnSprite(): Cvs {
  const c = mk(44, 38), g = c.getContext('2d')!;
  rect(g, 2, 35, 40, 3, 'rgba(0,0,0,0.3)');
  rect(g, 4, 16, 36, 20, '#b3382c');
  for (let x = 6; x < 40; x += 4) rect(g, x, 16, 1, 20, '#8e2a22');
  // gambrel roof
  for (let i = 0; i < 12; i++) {
    const hw = 8 + Math.round(i * 1.55);
    rect(g, 22 - hw, 4 + i, hw * 2, 1, i % 3 === 2 ? '#4a3a34' : '#665248');
    rect(g, 22 - hw, 4 + i, 1, 1, '#8a7060');
  }
  rect(g, 6, 15, 32, 1, '#d8d0c4');
  // doors with white X
  rect(g, 15, 22, 14, 14, '#7e251e');
  rect(g, 15, 22, 14, 1, '#f4efe6'); rect(g, 15, 35, 14, 1, '#f4efe6'); rect(g, 15, 22, 1, 14, '#f4efe6'); rect(g, 28, 22, 1, 14, '#f4efe6'); rect(g, 22, 22, 1, 14, '#f4efe6');
  for (let i = 0; i < 12; i++) { rect(g, 16 + i, 23 + i, 1, 1, '#f4efe6'); rect(g, 27 - i, 23 + i, 1, 1, '#f4efe6'); }
  rect(g, 19, 9, 6, 5, '#2c1c18'); rect(g, 20, 10, 4, 3, '#e8c060'); // hay loft window
  return c;
}
export function windmillTower(): Cvs {
  const c = mk(28, 46), g = c.getContext('2d')!;
  rect(g, 2, 43, 24, 3, 'rgba(0,0,0,0.3)');
  for (let i = 0; i < 30; i++) {
    const hw = 5 + Math.round(i * 0.22), y = 14 + i;
    rect(g, 14 - hw, y, hw * 2, 1, '#e8dcc0');
    rect(g, 14 - hw, y, 2, 1, '#f6eed8'); rect(g, 14 + hw - 3, y, 3, 1, '#b8aa8a');
    if (i % 6 === 5) rect(g, 14 - hw, y, hw * 2, 1, '#9a8c6c');
  }
  for (let i = 0; i < 9; i++) { const hw = 8 - i; rect(g, 14 - hw, 5 + i, hw * 2, 1, i % 2 ? '#7a3a2a' : '#8e4630'); }
  rect(g, 11, 34, 6, 9, '#4a2a18'); rect(g, 12, 22, 4, 5, '#2c3a5a');
  return c;
}
export function windmillSails(): Cvs {
  const c = mk(48, 48), g = c.getContext('2d')!;
  g.translate(24, 24);
  for (let arm = 0; arm < 4; arm++) {
    g.save();
    g.rotate((arm * Math.PI) / 2);
    rect(g, -1, -22, 2, 20, '#6a4a2a');
    rect(g, 1, -21, 6, 13, '#efe8d8');
    for (let y = -20; y < -8; y += 3) rect(g, 1, y, 6, 1, '#b8ae98');
    rect(g, 4, -21, 1, 13, '#b8ae98');
    g.restore();
  }
  rect(g, -2, -2, 4, 4, '#4a2a18');
  return c;
}
export function scarecrow(): Cvs {
  const c = mk(14, 20), g = c.getContext('2d')!;
  rect(g, 6, 6, 2, 13, '#7a5230'); rect(g, 1, 8, 12, 2, '#7a5230');
  rect(g, 4, 9, 6, 6, '#3a6ab0'); rect(g, 5, 2, 4, 4, '#e8c878'); rect(g, 3, 1, 8, 2, '#5a3a20'); rect(g, 5, 4, 1, 1, '#222'); rect(g, 8, 4, 1, 1, '#222');
  rect(g, 0, 9, 2, 2, '#e8c878'); rect(g, 12, 9, 2, 2, '#e8c878');
  return c;
}
export function hayBale(): Cvs {
  const c = mk(14, 11), g = c.getContext('2d')!;
  rect(g, 1, 2, 12, 8, '#d4a93a'); rect(g, 1, 2, 12, 2, '#efcb5a'); rect(g, 1, 8, 12, 2, '#a8821e');
  rect(g, 4, 2, 1, 8, '#7a5a1a'); rect(g, 9, 2, 1, 8, '#7a5a1a');
  return c;
}

// ---------------------------------------------------------------- crops (drawn straight into the ground canvas)
const SOIL = ['#6b4a2e', '#744f31', '#5e4128'];
export function drawField(g: CanvasRenderingContext2D, x: number, y: number, crop: Crop) {
  const px = x * 16, py = y * 16, h = (i: number) => hash2(x, y, 600 + i);
  rect(g, px, py, 16, 16, SOIL[Math.floor(h(0) * 3)]);
  for (let r = 0; r < 4; r++) rect(g, px + r * 4 + 1, py, 2, 16, 'rgba(0,0,0,0.2)'); // furrows
  switch (crop) {
    case 'wheat':
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        const sx = px + r * 4 + 1, sy = py + k * 4 + Math.floor(h(r * 4 + k) * 2);
        rect(g, sx, sy + 1, 2, 5, '#c9a43a'); rect(g, sx, sy, 2, 2, '#f2d36a'); rect(g, sx + 1, sy + 2, 1, 4, '#e0b84a');
      }
      break;
    case 'sunflower':
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
        const sx = px + 3 + r * 8, sy = py + 3 + k * 8 + Math.floor(h(r * 2 + k) * 2);
        rect(g, sx + 1, sy + 3, 1, 6, '#3f8a38'); rect(g, sx - 1, sy + 1, 5, 3, '#ffd23a'); rect(g, sx, sy, 3, 5, '#ffd23a'); rect(g, sx + 1, sy + 1, 1, 3, '#5a3414'); rect(g, sx, sy + 2, 3, 1, '#5a3414');
      }
      break;
    case 'pumpkin':
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
        const sx = px + 2 + r * 8, sy = py + 3 + k * 8;
        rect(g, sx, sy + 1, 6, 5, '#e0781c'); rect(g, sx + 1, sy, 4, 1, '#f09a30'); rect(g, sx + 2, sy + 1, 1, 5, '#b85a10'); rect(g, sx + 2, sy - 1, 2, 2, '#3f7a2a');
        rect(g, sx + 6, sy + 3, 2, 1, '#4a9a38');
      }
      break;
    case 'cabbage':
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
        const sx = px + 2 + r * 8, sy = py + 2 + k * 8;
        rect(g, sx, sy + 1, 6, 5, '#4f9a44'); rect(g, sx + 1, sy, 4, 7, '#6cc05a'); rect(g, sx + 2, sy + 1, 2, 4, '#a4e888');
      }
      break;
    case 'lavender':
      for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
        const sx = px + r * 4 + 1, sy = py + k * 5 + 1;
        rect(g, sx, sy + 2, 2, 4, '#3f7a4a'); rect(g, sx, sy, 2, 3, '#9a68e0'); rect(g, sx, sy, 1, 2, '#c4a0f8');
      }
      break;
    case 'corn':
      for (let r = 0; r < 2; r++) {
        const sx = px + 3 + r * 8;
        rect(g, sx, py + 1, 2, 14, '#4a9a3a'); rect(g, sx - 2, py + 5, 6, 1, '#5ab048'); rect(g, sx - 2, py + 10, 6, 1, '#5ab048');
        rect(g, sx + 2, py + 6, 2, 4, '#f2d04a');
      }
      break;
  }
}
export function drawFence(g: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * 16, py = y * 16;
  rect(g, px, py + 6, 16, 2, '#a8743a'); rect(g, px, py + 11, 16, 2, '#a8743a');
  rect(g, px + 6, py + 3, 3, 12, '#7a5028'); rect(g, px + 6, py + 3, 3, 2, '#9a6a38');
}
export function drawPath(g: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * 16, py = y * 16;
  rect(g, px, py, 16, 16, hash2(x, y, 610) > 0.5 ? '#9a7a4e' : '#8f7046');
  for (let i = 0; i < 5; i++) rect(g, px + Math.floor(hash2(x, y, 611 + i) * 15), py + Math.floor(hash2(x, y, 620 + i) * 15), 2, 1, hash2(x, y, 630 + i) > 0.5 ? '#b89a68' : '#6e5434');
}
export function drawGate(g: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * 16, py = y * 16;
  rect(g, px, py, 16, 16, '#9a7a4e');
  rect(g, px, py + 3, 2, 12, '#7a5028'); rect(g, px + 14, py + 3, 2, 12, '#7a5028');
}
