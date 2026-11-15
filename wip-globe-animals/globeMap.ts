// A procedural world map of the real Earth: continent outlines (hand-simplified lon/lat polygons) coloured by
// climate region (deserts, rainforests, taiga, steppe, mountain ranges, ice). Pixel-art resolution, no modern features.
import { hash2, vnoise } from '@shared';
import { mk, type Cvs } from './art';

export const MAP_W = 720, MAP_H = 360;
export const HOME_LL = { lon: 9, lat: 49 }; // where the village is on the globe (central Europe: all four seasons)

type Poly = Array<[number, number]>;
const LAND: Poly[] = [
  [[-168,66],[-162,70],[-150,71],[-141,70],[-128,70],[-115,68],[-95,72],[-85,69],[-82,63],[-94,59],[-93,57],[-85,55],[-80,52],[-78,58],[-72,61],[-65,60],[-62,57],[-56,52],[-60,47],[-66,45],[-70,42],[-74,40],[-76,35],[-81,31],[-80,26],[-83,28],[-88,30],[-94,29],[-97,26],[-97,22],[-95,19],[-91,19],[-90,21],[-87,21],[-88,16],[-84,15],[-83,10],[-79,9],[-78,8],[-80,7],[-85,10],[-88,13],[-92,15],[-96,16],[-105,20],[-106,23],[-110,27],[-112,28],[-114,31],[-117,33],[-121,35],[-124,40],[-124,46],[-125,49],[-130,54],[-134,58],[-141,60],[-148,61],[-152,59],[-158,56],[-163,55],[-158,58],[-162,60],[-166,62]],
  [[-78,8],[-72,12],[-62,10],[-52,5],[-50,0],[-35,-5],[-39,-15],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-41],[-66,-47],[-68,-53],[-72,-54],[-74,-47],[-73,-38],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,0]],
  [[-9,37],[-9,43],[-2,43],[-1,46],[-4,48],[2,51],[5,53],[8,54],[9,57],[11,55],[14,54],[19,54],[22,57],[24,59],[29,60],[22,61],[21,64],[25,65],[22,66],[19,63],[17,61],[18,59],[16,56],[13,56],[11,59],[7,58],[5,60],[6,63],[12,66],[17,69],[24,71],[30,70],[40,67],[44,68],[53,68],[60,69],[70,73],[80,73],[90,76],[105,78],[115,74],[130,72],[140,72],[150,70],[160,69],[170,70],[180,68],[180,65],[172,63],[165,60],[160,54],[156,51],[155,58],[142,59],[137,54],[141,48],[140,42],[130,42],[129,36],[126,35],[126,38],[122,40],[121,37],[119,35],[122,31],[121,28],[117,23],[110,21],[108,17],[109,12],[105,9],[103,10],[100,13],[100,8],[103,1],[100,4],[98,9],[98,16],[94,17],[92,22],[88,22],[87,21],[80,15],[78,9],[77,8],[73,16],[72,21],[68,23],[66,25],[62,25],[57,26],[56,27],[52,28],[49,30],[48,29],[50,26],[52,24],[56,25],[59,23],[56,18],[52,16],[45,13],[43,13],[42,16],[39,21],[35,28],[34,31],[35,34],[36,36],[30,36],[27,37],[27,40],[24,40],[23,38],[22,37],[20,40],[19,42],[14,45],[12,45],[14,42],[17,40],[17,39],[16,38],[15,40],[12,42],[9,44],[6,43],[3,43],[0,40],[-1,37],[-5,36]],
  [[-17,21],[-16,14],[-13,9],[-10,6],[-5,5],[5,6],[9,4],[9,-1],[12,-5],[13,-12],[12,-17],[15,-27],[18,-34],[22,-34],[27,-33],[32,-28],[35,-22],[35,-18],[40,-15],[40,-10],[39,-5],[41,-1],[44,4],[51,11],[44,11],[43,12],[40,15],[37,20],[34,27],[32,31],[25,32],[20,32],[11,33],[10,37],[3,37],[-2,35],[-6,35],[-9,32],[-13,28]],
  [[114,-22],[122,-18],[130,-12],[136,-12],[142,-11],[146,-19],[153,-26],[150,-37],[141,-38],[135,-34],[129,-32],[115,-34]],
  [[-72,78],[-60,82],[-30,83],[-20,80],[-20,72],[-24,69],[-40,65],[-44,60],[-50,62],[-54,67],[-58,75]],
  [[44,-25],[47,-25],[50,-16],[49,-12],[46,-16],[44,-22]], [[172,-34],[178,-38],[175,-41],[172,-40]], [[172,-41],[174,-42],[170,-46],[167,-46]],
  [[130,31],[132,34],[136,35],[140,36],[141,41],[142,45],[140,40],[138,36],[133,35]],
  [[-5,50],[1,51],[2,53],[-2,56],[-3,58],[-6,58],[-5,55],[-3,54],[-5,52]], [[-10,52],[-6,52],[-6,55],[-9,54]], [[-24,64],[-14,64],[-15,66],[-22,66]],
  [[95,5],[98,4],[104,-2],[106,-6],[102,-4],[96,0]], [[109,1],[112,3],[117,7],[119,1],[116,-4],[111,-3]], [[105,-6],[114,-8],[110,-8]], [[131,-1],[141,-3],[150,-10],[142,-9],[137,-5],[133,-4]],
  [[-85,22],[-80,23],[-74,20],[-78,20]], [[119,10],[126,9],[125,18],[121,18]], [[80,7],[82,7],[81,9]],
];
const SEAS: Array<[number, number, number, number]> = [ // [lon0, lon1, lat0, lat1] inland seas / great lakes cut out of the land
  [47, 54, 37, 47], [28, 41, 41, 46.5], [-92, -76, 41, 49.5], [31, 36, 6, 14], [-92, -86, 42, 46],
];

function inPoly(x: number, y: number, p: Poly) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export const REGIONS = ['Ocean', 'Polar ice', 'Tundra', 'Taiga (northern forest)', 'Temperate forest', 'Rainforest', 'Savanna', 'Steppe and grassland', 'Desert', 'Mountains'] as const;
const COLORS = [[20, 70, 140], [240, 246, 252], [168, 180, 156], [44, 92, 72], [64, 140, 62], [28, 106, 48], [186, 164, 64], [158, 182, 84], [222, 186, 112], [124, 118, 104]];
const inBox = (lon: number, lat: number, a: number, b: number, c: number, d: number) => lon >= a && lon <= b && lat >= c && lat <= d;
const inEll = (lon: number, lat: number, cx: number, cy: number, rx: number, ry: number) => ((lon - cx) / rx) ** 2 + ((lat - cy) / ry) ** 2 < 1;

/** Region of a land point (0 = ocean is handled by the caller). */
function region(lon: number, lat: number, n: number): number {
  const a = Math.abs(lat);
  if (a > 70 || (lat < -64) || inEll(lon, lat, -40, 72, 24, 12)) return 1;
  // mountain ranges
  if (inEll(lon, lat, 88, 32, 16, 6) || inEll(lon, lat, 75, 38, 9, 3.5) || inEll(lon, lat, 10, 46.5, 7, 2.2) || inEll(lon, lat, -112, 44, 5, 15) || inEll(lon, lat, -108, 36, 4, 6)
    || inEll(lon, lat, -70, -22, 3.2, 28) || inEll(lon, lat, -75, 0, 3.5, 9) || inEll(lon, lat, 44, 42, 5, 1.6) || inEll(lon, lat, 60, 58, 2, 9) || inEll(lon, lat, 38, 9, 4, 4)
    || inEll(lon, lat, -3, 32, 5, 2) || inEll(lon, lat, 147, -36, 3, 4) || inEll(lon, lat, 100, 28, 3, 6)) return 9;
  // deserts
  if (inBox(lon, lat, -16 + n, 34, 16, 31) || inEll(lon, lat, 44, 24, 13, 8) || inEll(lon, lat, 103, 42.5, 14, 4.5) || inEll(lon, lat, 132, -25, 12, 6) || inEll(lon, lat, 22, -23, 5, 4)
    || inEll(lon, lat, 70, 27, 4, 3) || inEll(lon, lat, -70, -23, 2, 5) || inEll(lon, lat, 55, 32, 7, 4) || inEll(lon, lat, 84, 39, 6, 2) || inEll(lon, lat, -112, 36, 6, 4) || inEll(lon, lat, -68, -42, 3, 7)) return 8;
  // rainforests
  if (inEll(lon, lat, -62, -3, 14, 9) || inEll(lon, lat, 20, 0, 10, 6) || inEll(lon, lat, 110, 2, 18, 7) || inEll(lon, lat, -85, 12, 7, 5) || inEll(lon, lat, 138, -5, 9, 4) || inEll(lon, lat, 47, -17, 2, 5)) return 5;
  if (a > 63) return 2;
  if (a > 50 && ((lon > -135 && lon < -55) || (lon > 18 && lon < 175))) return 3;
  // savanna / steppe
  if ((inEll(lon, lat, 15, 8, 30, 7) || inEll(lon, lat, 28, -14, 14, 7) || inEll(lon, lat, -52, -14, 8, 8) || inEll(lon, lat, 135, -16, 12, 4) || inEll(lon, lat, 78, 20, 6, 6)) ) return 6;
  if (inEll(lon, lat, -100, 42, 8, 9) || inEll(lon, lat, 68, 48, 20, 5) || inEll(lon, lat, -62, -34, 7, 6) || inEll(lon, lat, 118, 45, 14, 4) || inEll(lon, lat, 30, 50, 8, 3)) return 7;
  return 4;
}

export interface GlobeMap { canvas: Cvs; land: Uint8Array; reg: Uint8Array }
let cached: GlobeMap | null = null;

export function buildGlobeMap(): GlobeMap {
  if (cached) return cached;
  const canvas = mk(MAP_W, MAP_H), g = canvas.getContext('2d')!;
  const img = g.createImageData(MAP_W, MAP_H), d = img.data;
  const land = new Uint8Array(MAP_W * MAP_H), reg = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const lon0 = -180 + ((x + 0.5) / MAP_W) * 360, lat0 = 90 - ((y + 0.5) / MAP_H) * 180;
    const lon = lon0 + (vnoise(x / 9, y / 9, 1) - 0.5) * 3.2, lat = lat0 + (vnoise(x / 9 + 40, y / 9, 2) - 0.5) * 3.2; // ragged coasts
    let isLand = lat < -68 + (vnoise(x / 18, 0, 3) - 0.5) * 6 || LAND.some((p) => inPoly(lon, lat, p));
    if (isLand && SEAS.some(([a, b, c, e]) => inBox(lon, lat, a, b, c, e))) isLand = false;
    land[y * MAP_W + x] = isLand ? 1 : 0;
  }
  // distance to the coast (cheap blur) for shallow-water tint
  const blur = new Float32Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let s = 0, n = 0;
    for (let dy = -5; dy <= 5; dy += 2) for (let dx = -5; dx <= 5; dx += 2) { s += land[((y + dy + MAP_H) % MAP_H) * MAP_W + ((x + dx + MAP_W) % MAP_W)]; n++; }
    blur[y * MAP_W + x] = s / n;
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, o = i * 4;
    const lon = -180 + ((x + 0.5) / MAP_W) * 360, lat = 90 - ((y + 0.5) / MAP_H) * 180;
    let r: number, gg: number, b: number;
    if (!land[i]) {
      const t = Math.min(1, blur[i] * 2.4), swell = 0.96 + (vnoise(x / 6, y / 6, 4) - 0.5) * 0.14;
      r = (18 + 28 * t) * swell; gg = (62 + 70 * t) * swell; b = (128 + 64 * t) * swell;
      if (t > 0.78) { r += 40; gg += 40; } // coastal foam
    } else {
      const n = vnoise(x / 14, y / 14, 5) * 14 - 7;
      const rg = region(lon, lat, n); reg[i] = rg;
      const c = COLORS[rg], shade = 0.88 + vnoise(x / 3, y / 3, 6) * 0.26 + (rg === 9 ? (hash2(x, y, 7) - 0.5) * 0.35 : 0);
      r = c[0] * shade; gg = c[1] * shade; b = c[2] * shade;
      if (rg === 9 && vnoise(x / 5, y / 5, 8) > 0.64) { r = 236; gg = 242; b = 248; } // snow caps
      if (rg === 8 && vnoise(x / 7, y / 7, 9) > 0.7) { r *= 1.08; gg *= 1.05; }
    }
    d[o] = Math.min(255, r); d[o + 1] = Math.min(255, gg); d[o + 2] = Math.min(255, b); d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cached = { canvas, land, reg };
  return cached;
}

export const isLandLL = (m: GlobeMap, lon: number, lat: number) => {
  const x = Math.floor(((((lon + 180) % 360) + 360) % 360) / 360 * MAP_W), y = Math.min(MAP_H - 1, Math.max(0, Math.floor((90 - lat) / 180 * MAP_H)));
  return m.land[y * MAP_W + x] === 1;
};
export const regionLL = (m: GlobeMap, lon: number, lat: number) => {
  const x = Math.floor(((((lon + 180) % 360) + 360) % 360) / 360 * MAP_W), y = Math.min(MAP_H - 1, Math.max(0, Math.floor((90 - lat) / 180 * MAP_H)));
  return m.land[y * MAP_W + x] ? REGIONS[m.reg[y * MAP_W + x]] : 'Ocean';
};

/** Seamless cloud layer (alpha only). */
export function buildClouds(): Cvs {
  const W = 512, H = 256, c = mk(W, H), g = c.getContext('2d')!, img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const th = (x / W) * Math.PI * 2, lat = (0.5 - y / H) * 180;
    const u = Math.cos(th) * 5 + 9, v = Math.sin(th) * 5 + lat / 16;
    const n = 0.55 * vnoise(u, v, 20) + 0.3 * vnoise(u * 2.1, v * 2.1, 21) + 0.15 * vnoise(u * 4.3, v * 4.3, 22);
    const a = Math.max(0, (n - 0.52) * 4.2);
    const o = (y * W + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.min(235, a * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
