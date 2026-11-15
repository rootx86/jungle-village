// Streams square chunks of an infinite world in and out around the camera.
import * as THREE from 'three';

export interface ChunkBase { cx: number; cy: number; group: THREE.Group; dispose(): void }

export class ChunkManager<C extends ChunkBase> {
  chunks = new Map<string, C>();
  root = new THREE.Group();
  constructor(private factory: (cx: number, cy: number) => C, public cap = 200) {}
  private key = (cx: number, cy: number) => `${cx},${cy}`;
  get(cx: number, cy: number) { return this.chunks.get(this.key(cx, cy)); }
  has(cx: number, cy: number) { return this.chunks.has(this.key(cx, cy)); }
  private add(cx: number, cy: number) {
    const c = this.factory(cx, cy);
    this.chunks.set(this.key(cx, cy), c);
    this.root.add(c.group);
  }
  /** Build the chunks around a point immediately (first frame). */
  warm(cx: number, cy: number, radius: number) {
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) if (!this.has(x, y)) this.add(x, y);
  }
  /** Make sure the visible range exists (nearest first, within a time budget) and drop far-away chunks. */
  update(x0: number, y0: number, x1: number, y1: number, budgetMs: number) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const missing: Array<[number, number]> = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.has(x, y)) missing.push([x, y]);
    missing.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
    const t0 = performance.now();
    for (const [x, y] of missing) {
      this.add(x, y);
      if (performance.now() - t0 > budgetMs) break;
    }
    if (this.chunks.size > this.cap) {
      const far = [...this.chunks.values()]
        .filter((c) => c.cx < x0 - 1 || c.cx > x1 + 1 || c.cy < y0 - 1 || c.cy > y1 + 1)
        .sort((a, b) => Math.hypot(b.cx - mx, b.cy - my) - Math.hypot(a.cx - mx, a.cy - my));
      for (const c of far) {
        if (this.chunks.size <= this.cap) break;
        this.root.remove(c.group); c.dispose(); this.chunks.delete(this.key(c.cx, c.cy));
      }
    }
  }
  disposeAll() { for (const c of this.chunks.values()) { this.root.remove(c.group); c.dispose(); } this.chunks.clear(); }
}
