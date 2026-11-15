'use client';
// Shared 2.5D plumbing. Ground is flat (XY plane); everything that stands up is a camera-facing sprite
// ("billboard") planted on the ground. The orthographic camera is tilted by TILT, so the z-buffer sorts
// objects correctly (trees in front of houses, villagers behind walls) and shadows fall on the ground.
// World px (X right, Y down) maps to three.js (X, -Y).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Pose } from '../lib/art';
import { villagerSprite, type Outfit } from '../lib/outfits';
import { texOf } from '../lib/tex';

export const TILT = 0.62;                 // radians from straight-down
export const CS = Math.cos(TILT), SN = Math.sin(TILT);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Planted at ground point (x, y): children are drawn in a camera-facing plane, y up = screen up. */
export function Bb({ x, y, z = 0, children }: { x: number; y: number; z?: number; children?: React.ReactNode }) {
  return <group position={[x, -y, z]} rotation={[TILT, 0, 0]}>{children}</group>;
}
/** Matrix for an upright instance standing at ground point (x, y). */
const _o = new THREE.Object3D();
export function standMatrix(x: number, y: number, sx = 1, sy = 1): THREE.Matrix4 {
  _o.position.set(x, -y, 0); _o.rotation.set(TILT, 0, 0); _o.scale.set(sx, sy, 1); _o.updateMatrix();
  return _o.matrix;
}

export interface VState { x: number; y: number; pose: Pose; flip: boolean; visible?: boolean }
export type Updater = (t: number, dt: number, s: VState) => void;

let shadowTex: THREE.CanvasTexture | null = null;
export function blobShadow(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.3)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export function Villager({ seed, init, update, outfit }: { seed: number; init: { x: number; y: number }; update: Updater; outfit?: Outfit }) {
  const grp = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Mesh>(null!);
  const shade = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const st = useRef<VState>({ x: init.x, y: init.y, pose: 'stand', flip: false });
  const sh = useMemo(() => blobShadow(), []);
  useFrame((state, dt) => {
    update(state.clock.elapsedTime, Math.min(dt, 0.1), st.current);
    const s = st.current, tx = texOf(villagerSprite(seed, s.pose, outfit));
    if (mat.current.map !== tx) { mat.current.map = tx; mat.current.needsUpdate = true; }
    grp.current.visible = s.visible !== false;
    grp.current.position.set(s.x, -s.y, 0);
    body.current.scale.x = s.flip ? -1 : 1;
  });
  return (
    <group ref={grp}>
      <mesh ref={shade} position={[2, -1, 0.05]} scale={[13, 6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={sh} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group rotation={[TILT, 0, 0]}>
        <mesh ref={body} position={[0, 8, 0]}>
          <planeGeometry args={[18, 18]} />
          <meshBasicMaterial ref={mat} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Strolls around `home` within a small box. */
export function makeWanderer(home: { x: number; y: number }, range = 56): Updater {
  let tx = home.x, ty = home.y, wait = Math.random() * 3, phase = 0;
  return (_t, dt, s) => {
    if (wait > 0) { wait -= dt; s.pose = 'stand'; return; }
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d < 1.5) {
      wait = 1.5 + Math.random() * 4;
      tx = home.x + (Math.random() - 0.5) * range; ty = home.y + Math.random() * 14;
      return;
    }
    const v = 14 * dt;
    s.x += (dx / d) * v; s.y += (dy / d) * v; s.flip = dx < 0;
    phase += dt;
    s.pose = Math.floor(phase / 0.22) % 2 ? 'walk0' : 'walk1';
  };
}

/** A sprite planted at ground point (x, y); (w, h) in px, anchored bottom-centre. */
export function Sprite({ canvas, x, y, w, h, dx = 0 }: { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; dx?: number }) {
  const tex = useMemo(() => texOf(canvas), [canvas]);
  return (
    <Bb x={x} y={y}>
      <mesh position={[dx, h / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.4} toneMapped={false} />
      </mesh>
    </Bb>
  );
}

// ------------------------------------------------------------------ camera
export interface CamCtl { focus: { x: number; y: number; z: number } | null }
export interface RigProps {
  points: Array<{ x: number; y: number }>; // ground px the view should include
  anchor: { x: number; y: number };         // ground px: always included (campfire / pad)
  minExtent: number; pad: number;           // px
  popupAt: { x: number; y: number; h: number } | null; // ground px of the building base + sprite height
  ctl?: React.MutableRefObject<CamCtl>;
}
export const MIN_ZOOM = 0.2, MAX_ZOOM = 18;
export function CameraRig({ points, anchor, minExtent, pad, popupAt, ctl }: RigProps) {
  const { camera, size, gl, scene } = useThree();
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __scene: unknown }).__scene = scene; // debug hook
  const pointsRef = useRef(points); pointsRef.current = points;
  const popRef = useRef(popupAt); popRef.current = popupAt;
  const cam = useRef({ x: anchor.x, y: anchor.y, z: 3, mul: 1, panX: 0, panY: 0, init: false });
  const v3 = useMemo(() => new THREE.Vector3(), []);
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __camState: unknown }).__camState = cam.current;

  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const c = cam.current, z = (camera as THREE.OrthographicCamera).zoom;
      c.panX -= (e.clientX - drag.x) / z;
      c.panY -= (e.clientY - drag.y) / (z * CS);
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = () => { drag = null; el.style.cursor = ''; };
    const zoomBy = (f: number) => { cam.current.mul = clamp(cam.current.mul * f, 0.06, 12); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0014)); };
    const onZoom = (e: Event) => { const d = (e as CustomEvent<number | 'reset'>).detail; if (d === 'reset') { cam.current.mul = 1; cam.current.panX = 0; cam.current.panY = 0; } else zoomBy(d as number); };
    const key = (e: KeyboardEvent) => { if (e.key === '+' || e.key === '=') zoomBy(1.25); else if (e.key === '-' || e.key === '_') zoomBy(0.8); else if (e.key === '0') onZoom(new CustomEvent('vv-zoom', { detail: 'reset' })); };
    window.addEventListener('vv-zoom', onZoom); window.addEventListener('keydown', key);
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('vv-zoom', onZoom); window.removeEventListener('keydown', key);
    };
  }, [gl, camera]);

  useFrame((_s, dt) => {
    const c = cam.current, oc = camera as THREE.OrthographicCamera;
    // fit the main settlement: the 60th-percentile house distance, so far-away hamlets do not force a huge zoom-out
    const pts = pointsRef.current;
    let rr = 0;
    if (pts.length) {
      const ds = pts.map((h) => Math.hypot(h.x - anchor.x, h.y - anchor.y)).sort((a, b) => a - b);
      rr = ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.6))];
    }
    const x0 = anchor.x - rr, x1 = anchor.x + rr, y0 = anchor.y - rr, y1 = anchor.y + rr;
    const w = Math.max(x1 - x0 + pad * 2, minExtent), h = Math.max(y1 - y0 + pad * 2, minExtent);
    // the ground is foreshortened by CS vertically, so fit height with that factor
    const minZ = MIN_ZOOM;
    let tz = clamp(Math.min(size.width / w, size.height / (h * CS)), minZ, 8), tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    const f = ctl?.current.focus;
    if (f) { tz = f.z; tx = f.x; ty = f.y; }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * (f ? 3.2 : 2.2));
    if (!c.init) { c.init = true; c.x = tx; c.y = ty; c.z = tz; }
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    c.z = Math.exp(Math.log(c.z) + (Math.log(tz) - Math.log(c.z)) * k);
    const z = clamp(f ? c.z : c.z * c.mul, MIN_ZOOM, MAX_ZOOM);
    const px = c.x + (f ? 0 : c.panX), py = c.y + (f ? 0 : c.panY);
    oc.left = -size.width / 2; oc.right = size.width / 2; oc.top = size.height / 2; oc.bottom = -size.height / 2;
    oc.near = 1; oc.far = 5000;
    oc.rotation.set(TILT, 0, 0);
    oc.position.set(px, -py - 2000 * SN, 2000 * CS);
    oc.zoom = z; oc.updateProjectionMatrix();
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __zoom: number }).__zoom = z;

    const pop = document.getElementById('popup');
    const at = popRef.current;
    if (pop && at) {
      v3.set(at.x, -at.y + at.h * CS, at.h * SN).project(oc);
      pop.style.left = `${(v3.x * 0.5 + 0.5) * size.width}px`;
      pop.style.top = `${(-v3.y * 0.5 + 0.5) * size.height}px`;
    }
  });
  return null;
}
