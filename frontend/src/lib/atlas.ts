// Sprite atlases + instanced upright-sprite meshes (one draw call for every tree / peak / crystal in a chunk).
import * as THREE from 'three';
import { mk, treeSprite, type Cvs } from './art';
import { extraTreeSprite } from './art3';
import { bigPeak, PEAK_SIZE } from './art4';
import { moonFeatureSprite } from './moonart';
import { TILT } from '../components/common';

const VERT = `
attribute vec4 aUV;
varying vec2 vUv;
void main() {
  vUv = aUV.xy + uv * aUV.zw;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = c;
}`;

export interface Atlas { tex: THREE.CanvasTexture; uv: number[]; cw: number; ch: number; mat: THREE.ShaderMaterial }

/** Packs sprites into one texture (bottom-centre in each cell); `uv` holds (u0, v0, du, dv) per sprite index. */
export function buildAtlas(sprites: Cvs[], cw: number, ch: number, cols: number): Atlas {
  const rows = Math.ceil(sprites.length / cols), W = cols * cw, H = rows * ch;
  const c = mk(W, H), g = c.getContext('2d')!;
  const uv: number[] = [];
  sprites.forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    g.drawImage(s, col * cw + Math.floor((cw - s.width) / 2), row * ch + (ch - s.height));
    uv.push(col * cw / W, 1 - (row + 1) * ch / H, cw / W, ch / H);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace; // raw passthrough in the custom shader
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
  return { tex, uv, cw, ch, mat };
}

let trees: Atlas | null = null, peaks: Atlas | null = null, moon: Atlas | null = null;
const treeCache = new Map<string, Cvs>();
export function treeSpr(kind: number, v: number): Cvs {
  const k = `${kind}-${v}`;
  let s = treeCache.get(k);
  if (!s) { s = kind >= 10 ? extraTreeSprite(kind, v) : treeSprite(kind, v); treeCache.set(k, s); }
  return s;
}
export function treeAtlas(): Atlas {
  if (!trees) {
    const sprites: Cvs[] = [];
    for (let kind = 1; kind <= 17; kind++) for (let v = 0; v < 4; v++) sprites.push(treeSpr(kind, v));
    trees = buildAtlas(sprites, 32, 40, 8);
  }
  return trees;
}
const peakCache = new Map<string, Cvs>();
export function peakSpr(size: number, v: number): Cvs {
  const k = `${size}-${v}`;
  let c = peakCache.get(k);
  if (!c) { c = bigPeak(size, v + 1); peakCache.set(k, c); }
  return c;
}
export function peakAtlas(): Atlas {
  if (!peaks) {
    const sprites: Cvs[] = [];
    for (let size = 0; size < 3; size++) for (let v = 0; v < 4; v++) sprites.push(peakSpr(size, v));
    peaks = buildAtlas(sprites, PEAK_SIZE[2][0], PEAK_SIZE[2][1], 4);
  }
  return peaks;
}
export function moonAtlas(): Atlas {
  if (!moon) {
    const sprites: Cvs[] = [];
    for (let kind = 1; kind <= 6; kind++) for (let v = 0; v < 4; v++) sprites.push(moonFeatureSprite(kind, v));
    moon = buildAtlas(sprites, 40, 48, 8);
  }
  return moon;
}

export interface Inst { x: number; y: number; sprite: number; s?: number }
/** One InstancedMesh with every instance upright at ground point (x, y) (px). */
export function instancedSprites(atlas: Atlas, items: Inst[]) {
  const geo = new THREE.PlaneGeometry(atlas.cw, atlas.ch);
  geo.translate(0, atlas.ch / 2, 0);
  const uvAttr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, items.length) * 4), 4);
  geo.setAttribute('aUV', uvAttr);
  const mesh = new THREE.InstancedMesh(geo, atlas.mat, Math.max(1, items.length));
  mesh.count = items.length;
  mesh.frustumCulled = false;
  const o = new THREE.Object3D();
  items.forEach((t, i) => {
    const s = t.s ?? 1;
    o.position.set(t.x, -t.y, 0); o.rotation.set(TILT, 0, 0); o.scale.set(s, s, 1); o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    const k = t.sprite * 4;
    uvAttr.setXYZW(i, atlas.uv[k], atlas.uv[k + 1], atlas.uv[k + 2], atlas.uv[k + 3]);
  });
  mesh.instanceMatrix.needsUpdate = true; uvAttr.needsUpdate = true;
  return mesh;
}

/** Instanced upright sprites whose matrices and uv rects are rewritten every frame (animals, ships). */
export function dynamicSprites(atlas: Atlas, max: number) {
  const geo = new THREE.PlaneGeometry(atlas.cw, atlas.ch);
  geo.translate(0, atlas.ch / 2, 0);
  const uv = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  uv.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aUV', uv);
  const mesh = new THREE.InstancedMesh(geo, atlas.mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.count = 0;
  return { mesh, uv };
}
