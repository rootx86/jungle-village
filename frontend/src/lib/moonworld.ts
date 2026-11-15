// The Moon: an infinite, chunk-streamed lunar world with the biomes of other planets
// (grey highlands, dark mare, Mars dust, Europa ice, Io-style lava fields, alien crystal fields).
import * as THREE from 'three';
import {
  TILE, CHUNK_TILES as CT, MOON_PAD, MOON_CENTER, hash2, vnoise, fbm, moonBiomeAt, moonFeatureAt, isLava, cratersNear, type MoonBiome,
} from '@shared';
import { mk } from './art';
import { ChunkManager, type ChunkBase } from './chunks';
import { moonAtlas, instancedSprites, type Inst } from './atlas';

const CHUNK_PX = CT * TILE;
const VERTS = CT + 1;
const PAL: Record<MoonBiome, number[]> = {
  highlands: [128, 128, 138], mare: [60, 62, 78], mars: [180, 90, 56], europa: [190, 218, 236], volcanic: [42, 38, 46], crystal: [90, 62, 138],
};

export class MoonChunk implements ChunkBase {
  group = new THREE.Group();
  canvas = mk(CHUNK_PX, CHUNK_PX);
  texture: THREE.CanvasTexture;
  private disposables: Array<{ dispose(): void }> = [];

  constructor(public cx: number, public cy: number) {
    const x0 = cx * CT, y0 = cy * CT;
    const g = this.canvas.getContext('2d')!;
    const corner: MoonBiome[] = new Array(VERTS * VERTS);
    for (let j = 0; j < VERTS; j++) for (let i = 0; i < VERTS; i++) corner[j * VERTS + i] = moonBiomeAt(x0 + i, y0 + j);

    // regolith: 2px blocks, colour from the biome of the nearest (jittered) corner, modulated by noise
    const img = g.createImageData(CHUNK_PX, CHUNK_PX), d = img.data;
    for (let by = 0; by < CHUNK_PX / 2; by++) for (let bx = 0; bx < CHUNK_PX / 2; bx++) {
      const wx = x0 + (bx * 2 + 1) / TILE, wy = y0 + (by * 2 + 1) / TILE;
      const tx = Math.floor(bx * 2 / TILE), ty = Math.floor(by * 2 / TILE);
      const u = ((bx * 2) % TILE) / TILE + (hash2(bx + x0 * 8, by + y0 * 8, 250) - 0.5) * 0.5, v = ((by * 2) % TILE) / TILE + (hash2(bx + x0 * 8, by + y0 * 8, 251) - 0.5) * 0.5;
      const b = corner[(ty + (v > 0.5 ? 1 : 0)) * VERTS + tx + (u > 0.5 ? 1 : 0)];
      const base = PAL[b];
      let n = 0.55 * vnoise(wx / 5.5, wy / 5.5, 1) + 0.3 * vnoise(wx / 1.6, wy / 1.6, 2) + 0.15 * hash2(bx + x0 * 8, by + y0 * 8, 3);
      let k = 0.8 + n * 0.45;
      if (b === 'europa' && Math.abs(vnoise(wx / 1.35, wy / 1.35, 5) - 0.5) < 0.018) k *= 0.62;           // cracks in the ice
      if (b === 'crystal') k *= 0.9 + 0.2 * vnoise(wx / 2.2, wy / 2.2, 6);
      if (b === 'mars' && vnoise(wx / 3, wy / 3, 7) > 0.74) k *= 0.8;                                    // dust ripples
      const r = Math.min(255, base[0] * k), gg = Math.min(255, base[1] * k), bl = Math.min(255, base[2] * k * 1.03);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = ((by * 2 + dy) * CHUNK_PX + bx * 2 + dx) * 4;
        d[i] = r; d[i + 1] = gg; d[i + 2] = bl; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.save(); g.translate(-x0 * TILE, -y0 * TILE);

    // lava rivers
    for (let y = y0; y < y0 + CT; y++) for (let x = x0; x < x0 + CT; x++) {
      if (!isLava(x, y)) continue;
      g.fillStyle = hash2(x, y, 260) > 0.5 ? '#ff6a1a' : '#e84a10'; g.fillRect(x * TILE, y * TILE, TILE, TILE);
      for (let i = 0; i < 4; i++) { g.fillStyle = hash2(x, y, 262 + i) > 0.5 ? '#ffd060' : '#ffb02e'; g.fillRect(x * TILE + Math.floor(hash2(x, y, 270 + i) * 12), y * TILE + Math.floor(hash2(x, y, 280 + i) * 12), 3, 2); }
      if (!isLava(x, y - 1)) { g.fillStyle = '#2a2024'; g.fillRect(x * TILE, y * TILE, TILE, 2); }
      if (!isLava(x - 1, y)) { g.fillStyle = '#2a2024'; g.fillRect(x * TILE, y * TILE, 2, TILE); }
    }
    // craters: shadowed bowl, bright rim on the lit (north-west) side, dark rim opposite
    for (const c of cratersNear(x0, y0, x0 + CT, y0 + CT)) {
      const cxp = c.x * TILE, cyp = c.y * TILE, r = c.r * TILE;
      if (cxp + r < x0 * TILE || cxp - r > (x0 + CT) * TILE || cyp + r < y0 * TILE || cyp - r > (y0 + CT) * TILE) continue;
      const bowl = g.createRadialGradient(cxp - r * 0.2, cyp - r * 0.2, r * 0.1, cxp, cyp, r);
      bowl.addColorStop(0, 'rgba(30,28,40,0.55)'); bowl.addColorStop(0.8, 'rgba(50,48,62,0.35)'); bowl.addColorStop(1, 'rgba(50,48,62,0)');
      g.fillStyle = bowl; g.beginPath(); g.arc(cxp, cyp, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = Math.max(2, r * 0.07);
      g.strokeStyle = 'rgba(224,224,232,0.8)'; g.beginPath(); g.arc(cxp, cyp, r * 0.96, Math.PI * 0.75, Math.PI * 1.75); g.stroke();
      g.strokeStyle = 'rgba(30,30,42,0.7)'; g.beginPath(); g.arc(cxp, cyp, r * 0.96, -Math.PI * 0.25, Math.PI * 0.75); g.stroke();
    }
    // scattered pebbles
    for (let i = 0; i < 22; i++) {
      const px = (x0 + hash2(i, cx, 290) * CT) * TILE, py = (y0 + hash2(i, cy, 291) * CT) * TILE, s = 2 + hash2(i, cx + cy, 292) * 3;
      g.fillStyle = 'rgba(40,40,52,0.5)'; g.fillRect(px + 1, py + 1, s, s * 0.7);
      g.fillStyle = 'rgba(210,210,222,0.55)'; g.fillRect(px, py, s, s * 0.7);
    }
    // landing pad
    const pxp = MOON_PAD.x * TILE, pyp = MOON_PAD.y * TILE, pr = MOON_PAD.r * TILE;
    if (pxp + pr + 12 > x0 * TILE && pxp - pr - 12 < (x0 + CT) * TILE && pyp + pr + 12 > y0 * TILE && pyp - pr - 12 < (y0 + CT) * TILE) {
      g.fillStyle = '#7a7a86'; g.beginPath(); g.arc(pxp, pyp, pr + 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b4b4c0'; g.beginPath(); g.arc(pxp, pyp, pr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f2f2f6'; g.lineWidth = 4; g.beginPath(); g.arc(pxp, pyp, pr * 0.78, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e8c030'; for (let a = 0; a < 16; a++) { const t = (a / 16) * 6.28; g.fillRect(pxp + Math.cos(t) * (pr - 6) - 2, pyp + Math.sin(t) * (pr - 6) - 2, 4, 4); }
      g.fillStyle = '#f2f2f6'; g.fillRect(pxp - 3, pyp - pr * 0.6, 6, pr * 1.2); g.fillRect(pxp - pr * 0.6, pyp - 3, pr * 1.2, 6);
      g.fillStyle = 'rgba(70,70,82,0.55)';
      for (let t = 0; t < 60; t++) { const yy = pyp - pr - 8 - t * 6; g.fillRect(pxp - 9 + Math.sin(t / 5) * 4, yy, 3, 2); g.fillRect(pxp + 7 + Math.sin(t / 5) * 4, yy, 3, 2); }
    }

    // upright features (boulders, crystals, ice spires, vents, mesas, basalt): instanced + shadows
    const items: Inst[] = [];
    g.fillStyle = 'rgba(10,10,24,0.38)';
    for (let y = y0 - 2; y < y0 + CT + 2; y++) for (let x = x0 - 2; x < x0 + CT + 2; x++) {
      const f = moonFeatureAt(x, y);
      if (!f) continue;
      const jx = (hash2(x, y, 293) - 0.5) * 8, jy = (hash2(x, y, 294) - 0.5) * 6, s = 0.9 + hash2(x, y, 295) * 0.35;
      const bx = x * TILE + TILE / 2 + jx, by = (y + 1) * TILE + jy;
      g.beginPath(); g.ellipse(bx + 8 * s, by - 1, (f === 5 ? 20 : f === 3 ? 7 : 9) * s, 3.5 * s, -0.1, 0, Math.PI * 2); g.fill();
      if (x >= x0 && x < x0 + CT && y >= y0 && y < y0 + CT) items.push({ x: bx, y: by, sprite: (f - 1) * 4 + Math.floor(hash2(x, y, 296) * 4), s });
    }
    g.restore();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; this.texture.minFilter = THREE.NearestFilter; this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_PX, CHUNK_PX), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    ground.position.set(x0 * TILE + CHUNK_PX / 2, -(y0 * TILE + CHUNK_PX / 2), -0.01);
    this.group.add(ground);
    this.disposables.push(ground.geometry, ground.material as THREE.Material, this.texture);
    if (items.length) {
      const m = instancedSprites(moonAtlas(), items);
      this.group.add(m);
      this.disposables.push(m.geometry, m);
    }
  }
  dispose() { for (const d of this.disposables) d.dispose(); }
}

export class MoonWorld {
  manager = new ChunkManager<MoonChunk>((cx, cy) => new MoonChunk(cx, cy), 170);
  init() { this.manager.warm(Math.floor(MOON_CENTER.x / CT), Math.floor(70 / CT), 1); }
}
void fbm;
