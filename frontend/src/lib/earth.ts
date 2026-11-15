// Earth: an infinite world streamed in 25x25-tile chunks. Each chunk is
//   - one flat ground canvas texture (terrain, water, decoration, hill shading, cast shadows),
//   - one instanced mesh of upright trees, one of mountain peaks, and a few waterfall sheets.
// Houses clear a 4x4 tile yard; those trees are hidden and the ground is repainted.
import * as THREE from 'three';
import {
  TILE, CHUNK_TILES as CT, CENTER, hash2, treeAt, treeId, isWater, isMud, isRock, isFall, decorAt, biomeAt, clearingDist, yardTiles,
  vnoise, isSwampPool, altitude, peakInCell, farmAt, isFence, isPath, isLaunch, isPad, LAUNCH, FARMS, type Biome,
} from '@shared';
import { mk, decorSprite, rockTile, fallTexture, type Cvs } from './art';
import { extraDecor } from './art3';
import { PEAK_SIZE } from './art4';
import { drawField, drawFence, drawPath, drawGate } from './art2';
import { ChunkManager, type ChunkBase } from './chunks';
import { treeAtlas, peakAtlas, treeSpr, instancedSprites, type Inst } from './atlas';
import { TILT } from '../components/common';

export const CHUNK_PX = CT * TILE;
const VERTS = CT + 1;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const GRASS: Record<Biome, number[][]> = {
  emerald: ['#256a38', '#2a7440', '#2f7e48'].map(hex),
  golden: ['#8d7c2a', '#998832', '#a49440'].map(hex),
  blossom: ['#4f8a56', '#58945e', '#629e68'].map(hex),
  blue: ['#1c6068', '#226a73', '#28757f'].map(hex),
  lime: ['#52ab3c', '#5cb644', '#66c04e'].map(hex),
  snow: ['#e6f0fa', '#d8e6f4', '#f0f8ff'].map(hex),
  desert: ['#e2bf6a', '#d8b45c', '#eacb7e'].map(hex),
  swamp: ['#40502a', '#475b2e', '#3a4a26'].map(hex),
  tropical: ['#1b9640', '#22a247', '#29ae4f'].map(hex),
  mountain: ['#587a48', '#628652', '#6c905c'].map(hex),
};
const LIT = hex('#5a8a3c');
const smooth = (fx: number, fy: number) => vnoise(fx * 0.55, fy * 0.55, 64);
const relH = (a: number, b: number) => vnoise(a / 30, b / 30, 91) + 0.5 * vnoise(a / 12, b / 12, 92) + 0.25 * vnoise(a / 5, b / 5, 93);
/** Slope towards the sun (north-west): positive = lit hillside, negative = shaded. */
const relief = (fx: number, fy: number) => relH(fx - 0.35, fy - 0.35) - relH(fx + 0.35, fy + 0.35);
function mountainRgb(a: number, n: number): number[] {
  if (a > 0.74) return hex(n > 0.5 ? '#eef4fb' : '#dde8f4');
  if (a > 0.58) return hex(n > 0.66 ? '#e2eaf4' : n > 0.5 ? '#7c7886' : '#6c6878');
  if (a > 0.42) return hex(n > 0.55 ? '#726e7c' : '#66626f');
  return hex(n > 0.5 ? '#6e6c62' : '#66645a');
}

const decorCache = new Map<string, Cvs>();
const decor = (kind: number, v: number) => {
  const k = `${kind}-${v}`;
  let s = decorCache.get(k);
  if (!s) { s = kind >= 7 ? extraDecor(kind, v) : decorSprite(kind, v); decorCache.set(k, s); }
  return s;
};

let fallTex: THREE.CanvasTexture | null = null;
export function fallTexture3(): THREE.CanvasTexture {
  if (!fallTex) {
    fallTex = new THREE.CanvasTexture(fallTexture());
    fallTex.magFilter = THREE.NearestFilter; fallTex.minFilter = THREE.NearestFilter; fallTex.generateMipmaps = false;
    fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; fallTex.colorSpace = THREE.SRGBColorSpace;
  }
  return fallTex;
}

export class EarthChunk implements ChunkBase {
  group = new THREE.Group();
  x0: number; y0: number;
  canvas = mk(CHUNK_PX, CHUNK_PX);
  g = this.canvas.getContext('2d')!;
  texture: THREE.CanvasTexture;
  kinds = new Uint8Array((CT + 4) * (CT + 4)); // tree kind per tile, with a 2-tile margin for shadows
  cornerBiome: Biome[] = new Array(VERTS * VERTS);
  cornerAlt = new Float32Array(VERTS * VERTS);
  treeIndex = new Map<number, number>();
  treeMesh: THREE.InstancedMesh | null = null;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(public cx: number, public cy: number, private world: EarthWorld) {
    this.x0 = cx * CT; this.y0 = cy * CT;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; this.texture.minFilter = THREE.NearestFilter; this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    for (let j = 0; j < VERTS; j++) for (let i = 0; i < VERTS; i++) {
      this.cornerBiome[j * VERTS + i] = biomeAt(this.x0 + i, this.y0 + j);
      this.cornerAlt[j * VERTS + i] = altitude(this.x0 + i, this.y0 + j);
    }
    for (let j = -2; j < CT + 2; j++) for (let i = -2; i < CT + 2; i++) this.kinds[(j + 2) * (CT + 4) + (i + 2)] = treeAt(this.x0 + i, this.y0 + j);
    this.paint(this.x0, this.y0, this.x0 + CT - 1, this.y0 + CT - 1);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_PX, CHUNK_PX), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    ground.position.set(this.x0 * TILE + CHUNK_PX / 2, -(this.y0 * TILE + CHUNK_PX / 2), -0.01);
    this.group.add(ground);
    this.disposables.push(ground.geometry, ground.material as THREE.Material, this.texture);

    this.buildTrees();
    this.buildPeaks();
    this.buildFalls();
  }

  kind(x: number, y: number) { return this.kinds[(y - this.y0 + 2) * (CT + 4) + (x - this.x0 + 2)]; }
  hasTree(x: number, y: number) { return this.kind(x, y) > 0 && !this.world.cleared.has(treeId(x, y)); }

  private buildTrees() {
    const items: Inst[] = [], ids: number[] = [];
    for (let y = this.y0; y < this.y0 + CT; y++) for (let x = this.x0; x < this.x0 + CT; x++) {
      const kind = this.kind(x, y);
      if (!kind || this.world.cleared.has(treeId(x, y))) continue;
      const jx = (hash2(x, y, 33) - 0.5) * 7, jy = (hash2(x, y, 34) - 0.5) * 5;
      items.push({ x: x * TILE + TILE / 2 + jx, y: (y + 1) * TILE + jy, sprite: (kind - 1) * 4 + Math.floor(hash2(x, y, 31) * 4), s: [0.9, 1, 1.12, 1.26][Math.floor(hash2(x, y, 35) * 4)] });
      ids.push(treeId(x, y));
    }
    if (!items.length) return;
    this.treeMesh = instancedSprites(treeAtlas(), items);
    ids.forEach((id, i) => this.treeIndex.set(id, i));
    this.group.add(this.treeMesh);
    this.disposables.push(this.treeMesh.geometry, this.treeMesh);
  }

  private buildPeaks() {
    const items: Inst[] = [];
    for (let gy = Math.floor(this.y0 / 4); gy <= Math.floor((this.y0 + CT - 1) / 4); gy++)
      for (let gx = Math.floor(this.x0 / 4); gx <= Math.floor((this.x0 + CT - 1) / 4); gx++) {
        const p = peakInCell(gx, gy);
        if (!p || p.x < this.x0 || p.x >= this.x0 + CT || p.y < this.y0 || p.y >= this.y0 + CT) continue;
        items.push({ x: p.x * TILE + 8, y: (p.y + 1) * TILE + 4, sprite: p.size * 4 + p.v });
      }
    if (!items.length) return;
    const m = instancedSprites(peakAtlas(), items);
    this.group.add(m);
    this.disposables.push(m.geometry, m);
  }

  /** Waterfalls: connected groups of fall tiles become vertical sheets of water. */
  private buildFalls() {
    const tiles: Array<[number, number]> = [];
    for (let y = this.y0; y < this.y0 + CT; y++) for (let x = this.x0; x < this.x0 + CT; x++) if (isFall(x, y)) tiles.push([x, y]);
    if (!tiles.length) return;
    const key = (x: number, y: number) => y * 100003 + x;
    const set = new Set(tiles.map(([x, y]) => key(x, y))), seen = new Set<number>();
    for (const [sx, sy] of tiles) {
      if (seen.has(key(sx, sy))) continue;
      let minX = sx, maxX = sx, minY = sy, maxY = sy;
      const stack: Array<[number, number]> = [[sx, sy]];
      seen.add(key(sx, sy));
      while (stack.length) {
        const [x, y] = stack.pop()!;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const k = key(x + dx, y + dy);
          if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
        }
      }
      const w = (maxX - minX + 1) * TILE, h = Math.max(24, (maxY - minY + 1) * TILE);
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: fallTexture3(), toneMapped: false }));
      mesh.position.set((minX + maxX + 1) / 2 * TILE, -((maxY + 1) * TILE), 0);
      mesh.rotation.set(TILT, 0, 0);
      this.group.add(mesh);
      this.disposables.push(geo, mesh.material as THREE.Material);
    }
  }

  /** Remove tree instances (trees chopped / cleared under a house). */
  hide(ids: number[]) {
    if (!this.treeMesh) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    let touched = false;
    for (const id of ids) { const i = this.treeIndex.get(id); if (i !== undefined) { this.treeMesh.setMatrixAt(i, zero); touched = true; } }
    if (touched) this.treeMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ ground painting
  /** Repaint a tile rectangle (inclusive, world coordinates; clipped to this chunk). */
  paint(ax0: number, ay0: number, ax1: number, ay1: number) {
    const x0 = Math.max(ax0, this.x0), y0 = Math.max(ay0, this.y0), x1 = Math.min(ax1, this.x0 + CT - 1), y1 = Math.min(ay1, this.y0 + CT - 1);
    if (x0 > x1 || y0 > y1) return;
    const g = this.g;
    g.save();
    g.translate(-this.x0 * TILE, -this.y0 * TILE);
    g.beginPath(); g.rect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE); g.clip();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.ground(g, x, y);
    this.shadows(g, x0, y0, x1, y1);
    g.restore();
    this.texture.needsUpdate = true;
  }

  private ground(g: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    if (isSwampPool(x, y)) {
      g.fillStyle = hash2(x, y, 2) > 0.5 ? '#3a5a3c' : '#436446'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#5a8a48';
      if (hash2(x, y, 3) > 0.55) { g.fillRect(px + 3, py + 5, 5, 3); g.fillStyle = '#7ab060'; g.fillRect(px + 4, py + 5, 2, 1); }
      g.fillStyle = 'rgba(20,40,20,0.35)'; g.fillRect(px + Math.floor(hash2(x, y, 4) * 10), py + 10, 5, 1);
      return;
    }
    if (isWater(x, y)) {
      const deep = hash2(x, y, 2);
      g.fillStyle = isFall(x, y) ? '#3f86cc' : deep > 0.66 ? '#1a4a8c' : deep > 0.33 ? '#1f56a0' : '#2563b0';
      g.fillRect(px, py, TILE, TILE);
      if (!isWater(x, y - 1)) { g.fillStyle = '#6fb0ee'; g.fillRect(px, py, TILE, 2); }
      if (!isWater(x - 1, y)) { g.fillStyle = '#4d8fd8'; g.fillRect(px, py, 2, TILE); }
      for (let i = 0; i < 3; i++) if (hash2(x, y, 40 + i) > 0.5) {
        g.fillStyle = hash2(x, y, 45 + i) > 0.5 ? '#9ccaf6' : '#e4f3ff';
        g.fillRect(px + Math.floor(hash2(x, y, 50 + i) * 12), py + Math.floor(hash2(x, y, 60 + i) * 14), 3, 1);
      }
      return;
    }
    if (isRock(x, y)) { g.drawImage(rockTile(x, y, !isRock(x, y - 1), !isRock(x, y + 1)), px, py); return; }
    if (isMud(x, y)) {
      g.fillStyle = '#5a3a28'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#42281a';
      for (let r = 0; r < TILE; r += 4) g.fillRect(px, py + r + (((x % 2) + 2) % 2), TILE, 1);
      return;
    }
    const farm = farmAt(x, y);
    if (farm) { drawField(g, x, y, farm.crop); return; }
    const fence = isFence(x, y);
    const gate = FARMS.find((f) => f.gx === x && f.gy === y);
    if (fence || gate) {
      const c = GRASS[biomeAt(x, y)][1];
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(px, py, TILE, TILE);
      if (gate) drawGate(g, x, y); else drawFence(g, x, y);
      return;
    }
    if (isPath(x, y)) { drawPath(g, x, y); return; }
    if (isLaunch(x, y)) { this.launchTile(g, x, y); return; }
    const d = clearingDist(x, y);
    const bio = this.groundColor(g, x, y, d);
    if (bio === 'desert') { g.fillStyle = 'rgba(255,240,190,0.35)'; g.fillRect(px + (((y % 2) + 2) % 2) * 4, py + 5, 9, 1); g.fillStyle = 'rgba(140,100,40,0.25)'; g.fillRect(px + 2, py + 11, 10, 1); }
    if (bio === 'snow' && hash2(x, y, 9) > 0.6) { g.fillStyle = '#ffffff'; g.fillRect(px + Math.floor(hash2(x, y, 10) * 14), py + Math.floor(hash2(x, y, 11) * 14), 2, 1); }
    if (this.hasTree(x, y)) return; // hidden under a tree: skip the details
    for (let i = 0; i < 3; i++) {
      g.fillStyle = d < 8 && hash2(x, y, 90 + i) > 0.8 ? '#f2eaa8' : hash2(x, y, 95 + i) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.16)';
      g.fillRect(px + Math.floor(hash2(x, y, 70 + i) * 15), py + Math.floor(hash2(x, y, 80 + i) * 15), 1, 1);
    }
    const dec = decorAt(x, y);
    if (dec) g.drawImage(decor(dec, Math.floor(hash2(x, y, 103) * 6)), px, py);
  }

  private launchTile(g: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    if (isPad(x, y)) {
      g.fillStyle = hash2(x, y, 5) > 0.5 ? '#a49a88' : '#9a9080'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px + 7, py, 1, TILE); g.fillRect(px, py + 7, TILE, 1);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px, py, TILE, 1);
      const edge = x === 170 || x === 182 || y === 161 || y === 175;
      if (edge) { g.fillStyle = '#6e6a62'; g.fillRect(px, py, TILE, 3); g.fillRect(px, py + 13, TILE, 3); g.fillRect(px, py, 3, TILE); g.fillRect(px + 13, py, 3, TILE); }
    } else {
      g.fillStyle = hash2(x, y, 5) > 0.5 ? '#d2b474' : '#c9aa6a'; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 4; i++) { g.fillStyle = hash2(x, y, 70 + i) > 0.5 ? 'rgba(255,240,190,0.4)' : 'rgba(120,90,40,0.3)'; g.fillRect(px + Math.floor(hash2(x, y, 80 + i) * 14), py + Math.floor(hash2(x, y, 90 + i) * 14), 2, 1); }
      if (x === LAUNCH.x0 || x === LAUNCH.x1 || y === LAUNCH.y0 || y === LAUNCH.y1) { g.fillStyle = '#7a5a30'; g.fillRect(px + 6, py + 3, 3, 12); g.fillRect(px, py + 7, TILE, 2); }
    }
  }

  /** Ground colour with hill shading. Borders (biome and slope) are painted in 4px blocks using the chunk's corner grid. */
  private groundColor(g: CanvasRenderingContext2D, x: number, y: number, d: number): Biome {
    const px = x * TILE, py = y * TILE, lx = x - this.x0, ly = y - this.y0;
    const c00 = this.cornerBiome[ly * VERTS + lx], c10 = this.cornerBiome[ly * VERTS + lx + 1], c01 = this.cornerBiome[(ly + 1) * VERTS + lx], c11 = this.cornerBiome[(ly + 1) * VERTS + lx + 1];
    const a00 = this.cornerAlt[ly * VERTS + lx], a10 = this.cornerAlt[ly * VERTS + lx + 1], a01 = this.cornerAlt[(ly + 1) * VERTS + lx], a11 = this.cornerAlt[(ly + 1) * VERTS + lx + 1];
    const uniform = c00 === c10 && c00 === c01 && c00 === c11 && c00 !== 'mountain' && d > 11 && a00 + a10 + a01 + a11 === 0;
    const N = uniform ? 2 : 4, S = TILE / N;
    const corners = [c00, c10, c01, c11];
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const u = (sx + 0.5) / N, v = (sy + 0.5) / N, fx = x + u, fy = y + v;
      const a = (a00 * (1 - u) + a10 * u) * (1 - v) + (a01 * (1 - u) + a11 * u) * v, n = hash2(x * 4 + sx, y * 4 + sy, 6);
      let rgb: number[];
      if (a > 0.3) rgb = mountainRgb(a, 0.75 * smooth(fx, fy) + 0.25 * n);
      else {
        const ju = u + (hash2(x * 4 + sx, y * 4 + sy, 7) - 0.5) * 0.55, jv = v + (hash2(x * 4 + sx, y * 4 + sy, 8) - 0.5) * 0.55;
        const b = uniform ? c00 : corners[(jv > 0.5 ? 2 : 0) + (ju > 0.5 ? 1 : 0)];
        const base = GRASS[b][Math.floor(n * 3)];
        const dd = clearingDist(fx, fy);
        rgb = dd < 10 ? lerp(base, LIT, Math.min(1, (10 - dd) / 5)) : b === 'mountain' ? lerp(base, hex('#74747a'), Math.max(0, (a - 0.02) / 0.28) * 0.55) : base;
      }
      const k = clampN(1 + relief(fx, fy) * 2.2, 0.8, 1.2);
      const warm = k > 1 ? (k - 1) * 40 : 0, cool = k < 1 ? (1 - k) * 30 : 0;
      g.fillStyle = `rgb(${Math.round(rgb[0] * k + warm)},${Math.round(rgb[1] * k + warm * 0.7)},${Math.round(rgb[2] * k + cool)})`;
      g.fillRect(px + sx * S, py + sy * S, S, S);
    }
    return c00;
  }

  /** Soft cast shadows: sun in the north-west, so shadows lean to the south-east. */
  private shadows(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    g.fillStyle = 'rgba(4,14,10,0.34)';
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      if (x < this.x0 - 2 || x >= this.x0 + CT + 2 || y < this.y0 - 2 || y >= this.y0 + CT + 2) continue;
      if (!this.hasTree(x, y)) continue;
      const kind = this.kind(x, y), s = [0.9, 1, 1.12, 1.26][Math.floor(hash2(x, y, 35) * 4)];
      const jx = (hash2(x, y, 33) - 0.5) * 7, jy = (hash2(x, y, 34) - 0.5) * 5;
      const bx = x * TILE + TILE / 2 + jx, by = (y + 1) * TILE + jy;
      const w = (kind === 12 ? 5 : kind === 13 || kind === 14 ? 12 : 8) * s;
      g.beginPath(); g.ellipse(bx + 5 * s, by - 1, w + 3 * s, 3.2 * s, -0.12, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(14,16,28,0.30)';
    for (let gy = Math.floor((y0 - 8) / 4); gy <= Math.floor((y1 + 3) / 4); gy++) for (let gx = Math.floor((x0 - 8) / 4); gx <= Math.floor((x1 + 3) / 4); gx++) {
      const p = peakInCell(gx, gy);
      if (!p) continue;
      const [pw, ph] = PEAK_SIZE[p.size];
      const bx = p.x * TILE + TILE / 2, by = (p.y + 1) * TILE + 4;
      g.beginPath(); g.ellipse(bx + pw * 0.38, by + ph * 0.06, pw * 0.62, ph * 0.13, -0.08, 0, Math.PI * 2); g.fill();
    }
  }

  dispose() { for (const d of this.disposables) d.dispose(); }
}

export class EarthWorld {
  cleared = new Set<number>();
  manager = new ChunkManager<EarthChunk>((cx, cy) => new EarthChunk(cx, cy, this), 190);

  /** Houses already standing: their yards are cleared; builds the chunks around the village. */
  init(houses: Array<{ x: number; y: number }>) {
    for (const h of houses) for (const [x, y] of yardTiles(h.x, h.y)) this.cleared.add(treeId(x, y));
    this.manager.warm(Math.floor(CENTER.x / CT), Math.floor(CENTER.y / CT), 1);
  }
  spriteFor(x: number, y: number): Cvs | null {
    const t = treeAt(x, y);
    return t ? treeSpr(t, Math.floor(hash2(x, y, 31) * 4)) : null;
  }
  private affect(x0: number, y0: number, x1: number, y1: number, ids: number[]) {
    for (let cy = Math.floor((y0 - 3) / CT); cy <= Math.floor((y1 + 3) / CT); cy++)
      for (let cx = Math.floor((x0 - 3) / CT); cx <= Math.floor((x1 + 3) / CT); cx++) {
        const c = this.manager.get(cx, cy);
        if (!c) continue;
        c.hide(ids);
        c.paint(x0 - 3, y0 - 3, x1 + 3, y1 + 3);
      }
  }
  clearTile(x: number, y: number) { this.cleared.add(treeId(x, y)); this.affect(x, y, x, y, [treeId(x, y)]); }
  clearYard(hx: number, hy: number) {
    const ids: number[] = [];
    for (const [x, y] of yardTiles(hx, hy)) { this.cleared.add(treeId(x, y)); ids.push(treeId(x, y)); }
    this.affect(hx - 2, hy - 2, hx + 1, hy + 1, ids);
  }
}
