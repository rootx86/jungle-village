'use client';
// The whole planet: a lit, rotating globe with real continents, deserts, forests, mountains and ice, a cloud layer,
// an atmosphere, stars and sailing ships. Zoom in on the home marker to land in the village; zoom out of the village to get here.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildClouds, buildGlobeMap, HOME_LL, isLandLL, regionLL } from '../lib/globeMap';
import { vesselSprite } from '../lib/animals';
import { softBlob } from '../lib/art';

const D2R = Math.PI / 180;
const ll = (lat: number, lon: number, r: number) => new THREE.Vector3(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const NEAR = 1.34, FAR = 9;

function Inner({ arrival, signal, onDescend, onHover }: { arrival: boolean; signal: number; onDescend: () => void; onHover: (label: string) => void }) {
  const { camera, gl, size } = useThree();
  const map = useMemo(() => buildGlobeMap(), []);
  const land = useMemo(() => {
    const t = new THREE.CanvasTexture(map.canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }, [map]);
  const cloudTex = useMemo(() => { const t = new THREE.CanvasTexture(buildClouds()); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  const shipTex = useMemo(() => { const t = new THREE.CanvasTexture(vesselSprite('ship', 0)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  const glow = useMemo(() => new THREE.CanvasTexture(softBlob('255,215,120', 1)), []);
  const earth = useRef<THREE.Group>(null!);
  const clouds = useRef<THREE.Mesh>(null!);
  const sphere = useRef<THREE.Mesh>(null!);
  const pulse = useRef<THREE.Sprite>(null!);
  const st = useRef({ lon: HOME_LL.lon, lat: HOME_LL.lat, vLon: 0, vLat: 0, dist: arrival ? 1.42 : 4.4, target: arrival ? 4.4 : 4.4, idle: 0, drag: false, descending: false, fired: false, ray: new THREE.Raycaster(), mouse: new THREE.Vector2(), begun: signal });

  const stars = useMemo(() => {
    const p = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), r = 30; p[i * 3] = r * Math.sin(b) * Math.cos(a); p[i * 3 + 1] = r * Math.sin(b) * Math.sin(a); p[i * 3 + 2] = r * Math.cos(b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const ships = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    let lon = 0, lat = 0;
    for (let k = 0; k < 200; k++) { lon = (Math.random() - 0.5) * 340; lat = (Math.random() - 0.5) * 120; if (!isLandLL(map, lon, lat)) break; }
    return { lon, lat, h: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.7, big: i % 3 !== 0, ref: null as THREE.Sprite | null };
  }), [map]);

  useEffect(() => {
    const el = gl.domElement, s = st.current;
    let last = { x: 0, y: 0 };
    const down = (e: PointerEvent) => { s.drag = true; last = { x: e.clientX, y: e.clientY }; s.idle = 0; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => {
      if (s.drag && !s.descending) {
        const k = 0.16 * (s.dist / 4.4);
        s.vLon = -(e.clientX - last.x) * k; s.vLat = (e.clientY - last.y) * k;
        s.lon += s.vLon; s.lat = clamp(s.lat + s.vLat, -80, 80); last = { x: e.clientX, y: e.clientY }; s.idle = 0;
      } else {
        const r = el.getBoundingClientRect();
        s.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        s.ray.setFromCamera(s.mouse, camera);
        const hit = s.ray.intersectObject(sphere.current, false)[0];
        if (hit) { const p = earth.current.worldToLocal(hit.point.clone()); const lat = Math.asin(clamp(p.y, -1, 1)) / D2R, lon = Math.atan2(-p.z, p.x) / D2R; onHover(regionLL(map, lon, lat)); } else onHover('');
      }
    };
    const up = () => { s.drag = false; el.style.cursor = 'grab'; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); s.idle = 0;
      if (s.descending) return;
      s.target = clamp(s.target * Math.exp(e.deltaY * 0.0016), NEAR - 0.1, FAR);
      if (e.deltaY < 0 && s.target < 1.75) s.descending = true; // zoomed all the way in: land in the village
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('wheel', wheel, { passive: false });
    el.style.cursor = 'grab';
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, [gl, camera, map, onHover]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), s = st.current, t = state.clock.elapsedTime;
    if (signal > s.begun) { s.begun = signal; s.descending = true; }
    if (arrival && s.dist < 4.3 && !s.descending && s.target === 4.4) s.target = 4.4;
    if (s.descending) {
      s.lon += ((HOME_LL.lon - s.lon + 540) % 360 - 180) * Math.min(1, dt * 2.6); s.lat += (HOME_LL.lat - s.lat) * Math.min(1, dt * 2.6);
      s.target = 1.2;
      if (s.dist < NEAR && !s.fired) { s.fired = true; onDescend(); }
    } else if (!s.drag) {
      s.idle += dt;
      s.lon += s.vLon * 0.9; s.vLon *= 0.93; s.lat = clamp(s.lat + s.vLat * 0.9, -80, 80); s.vLat *= 0.93;
      if (s.idle > 2.5) s.lon += 1.6 * dt; // slow idle spin
    }
    s.dist += (s.target - s.dist) * (1 - Math.exp(-dt * (s.descending ? 2.4 : 5)));
    camera.position.set(0, 0, s.dist);
    earth.current.rotation.set(s.lat * D2R, (-90 - s.lon) * D2R, 0);
    clouds.current.rotation.y = t * 0.012;
    // ships: sail the seas, turn away from coasts
    for (const sh of ships) {
      const step = sh.sp * dt, nl = sh.lat + Math.sin(sh.h) * step, no = sh.lon + (Math.cos(sh.h) * step) / Math.max(0.3, Math.cos(sh.lat * D2R));
      if (isLandLL(map, no + Math.cos(sh.h) * 1.5, nl + Math.sin(sh.h) * 1.5) || Math.abs(nl) > 66) sh.h += Math.PI * (0.6 + Math.random() * 0.8);
      else { sh.lat = nl; sh.lon = no; }
      if (sh.ref) { sh.ref.position.copy(ll(sh.lat, sh.lon, 1.009)); const sc = sh.big ? 0.05 : 0.036; sh.ref.scale.set(sc, sc * 1.05, 1); }
    }
    if (pulse.current) { const k = 0.1 + ((t * 0.9) % 1) * 0.18; pulse.current.scale.set(k, k, 1); pulse.current.material.opacity = 1 - ((t * 0.9) % 1); }
    // label for the home marker
    const lab = document.getElementById('globe-home');
    if (lab) {
      const p = earth.current.localToWorld(ll(HOME_LL.lat, HOME_LL.lon, 1.02));
      const facing = p.clone().normalize().dot(camera.position.clone().normalize()) > 0.2;
      const v = p.clone().project(camera);
      lab.style.display = facing ? 'block' : 'none';
      lab.style.left = `${(v.x * 0.5 + 0.5) * size.width}px`; lab.style.top = `${(-v.y * 0.5 + 0.5) * size.height}px`;
    }
  });

  return (
    <>
      <color attach="background" args={['#03040a']} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[-5, 2.5, 4]} intensity={2.1} />
      <points geometry={stars}><pointsMaterial color="#cfd8ff" size={0.09} sizeAttenuation transparent opacity={0.9} /></points>
      <group ref={earth}>
        <mesh ref={sphere}>
          <sphereGeometry args={[1, 128, 96]} />
          <meshLambertMaterial map={land} />
        </mesh>
        <mesh ref={clouds}>
          <sphereGeometry args={[1.014, 96, 64]} />
          <meshLambertMaterial map={cloudTex} transparent opacity={0.8} depthWrite={false} />
        </mesh>
        {ships.map((sh, i) => (
          <sprite key={i} ref={(r) => { sh.ref = r; }} position={ll(sh.lat, sh.lon, 1.009)}>
            <spriteMaterial map={shipTex} transparent alphaTest={0.4} depthWrite={false} />
          </sprite>
        ))}
        <sprite position={ll(HOME_LL.lat, HOME_LL.lon, 1.012)} scale={[0.07, 0.07, 1]}>
          <spriteMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite ref={pulse} position={ll(HOME_LL.lat, HOME_LL.lon, 1.012)} scale={[0.1, 0.1, 1]}>
          <spriteMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} color="#fff0a0" />
        </sprite>
      </group>
      <mesh scale={1.07}>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial
          transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false}
          vertexShader="varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          fragmentShader="varying vec3 vN; void main(){ float i = pow(max(0.0, 0.78 - dot(vN, vec3(0.0,0.0,1.0))), 3.0); gl_FragColor = vec4(0.32,0.6,1.0,1.0) * i * 1.5; }"
        />
      </mesh>
    </>
  );
}

export default function Globe(props: { arrival: boolean; signal: number; onDescend: () => void; onHover: (label: string) => void }) {
  return (
    <>
      <Canvas camera={{ fov: 34, near: 0.05, far: 200, position: [0, 0, props.arrival ? 1.42 : 4.4] }} dpr={[1, 1.75]} gl={{ antialias: true }}>
        <Inner {...props} />
      </Canvas>
      <div id="globe-home">🏡 Home village</div>
    </>
  );
}
