import * as THREE from 'three';
import type { Cvs } from './art';

const cache = new WeakMap<Cvs, THREE.CanvasTexture>();

/** Canvas -> crisp (nearest-filtered) texture, cached per canvas. */
export function texOf(c: Cvs): THREE.CanvasTexture {
  let t = cache.get(c);
  if (!t) {
    t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(c, t);
  }
  return t;
}
