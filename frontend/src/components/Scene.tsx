'use client';
// Earth: React Three Fiber, tilted orthographic camera (2.5D). Flat ground chunks + upright sprites.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  TILE, CENTER, MUD, BARN, WINDMILL, FARMS, ROCKET, biomeAt,
  type Biome, type SubscriberDTO, type Tier,
} from '@shared';
import { bonesSprite, flameSprite, glowSprite, houseSprite as siteSprite, HOUSE_SIZE } from '../lib/art';
import { houseDims, houseSprite } from '../lib/houses';
import { barnSprite, hayBale, scarecrow, windmillSails, windmillTower } from '../lib/art2';
import { controlBuilding, gantrySprite, tankSprite } from '../lib/art4';
import type { EarthWorld } from '../lib/earth';
import { texOf } from '../lib/tex';
import { Bb, CameraRig, Sprite, TILT, Villager, blobShadow, clamp, makeWanderer, standMatrix, type CamCtl, type Updater } from './common';
import WorldLayer from './WorldLayer';
import RocketActor from './Rocket';

export const biomeOf = (s: { x: number; y: number }): Biome => biomeAt(s.x, s.y);

// ------------------------------------------------------------------ houses
function HouseInstances({ tier, biome, subs, selectedId, onSelect }: {
  tier: Tier; biome: Biome; subs: SubscriberDTO[]; selectedId: number | null; onSelect: (s: SubscriberDTO) => void;
}) {
  const [w, h] = houseDims(tier, biome);
  const ref = useRef<THREE.InstancedMesh>(null!);
  const cap = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, subs.length))));
  const tex = useMemo(() => texOf(houseSprite(tier, biome)), [tier, biome]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    subs.forEach((sub, i) => {
      m.setMatrixAt(i, standMatrix(sub.x * TILE, (sub.y + 1) * TILE));
      m.setColorAt(i, c.setScalar(sub.id === selectedId ? 1.5 : 1));
    });
    m.count = subs.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [subs, selectedId, cap]);
  return (
    <instancedMesh
      key={cap} ref={ref} args={[undefined, undefined, cap]} frustumCulled={false}
      onClick={(e: ThreeEvent<MouseEvent>) => { if (e.delta < 6 && e.instanceId !== undefined && subs[e.instanceId]) { e.stopPropagation(); onSelect(subs[e.instanceId]); } }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <planeGeometry args={[w, h]} onUpdate={(g) => g.translate(0, h / 2, 0)} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.4} toneMapped={false} />
    </instancedMesh>
  );
}

/** Soft cast shadows under every house (flat on the ground, leaning south-east). */
function HouseShadows({ subs }: { subs: SubscriberDTO[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const cap = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, subs.length))));
  const tex = useMemo(() => blobShadow(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    subs.forEach((s, i) => {
      const [w] = houseDims(s.tier, biomeOf(s));
      o.position.set(s.x * TILE + w * 0.18, -((s.y + 1) * TILE) - 1, 0.1); o.rotation.set(0, 0, 0); o.scale.set(w * 1.5, w * 0.7, 1); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = subs.length; m.instanceMatrix.needsUpdate = true;
  }, [subs, cap]);
  return (
    <instancedMesh key={cap} ref={ref} args={[undefined, undefined, cap]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

const MAX_RESIDENTS = 160;
function Resident({ sub }: { sub: SubscriberDTO }) {
  const home = useMemo(() => ({ x: sub.x * TILE - 4 + (sub.id % 5) * 2, y: (sub.y + 1) * TILE + 6 }), [sub]);
  const update = useMemo(() => makeWanderer(home), [home]);
  return <Villager seed={sub.id} outfit={biomeOf(sub)} init={home} update={update} />;
}

// ------------------------------------------------------------------ live build animation
const CHOP = 2.4, FALL = 0.8, BUILD = 3.6;
function Builder({ sub, spawn, forest, onDone }: { sub: SubscriberDTO; spawn: { x: number; y: number }; forest: EarthWorld; onDone: () => void }) {
  const hx = sub.x, hy = sub.y, biome = biomeOf(sub);
  const treeCanvas = useMemo(() => forest.spriteFor(hx, hy), [forest, hx, hy]);
  const CHOP = treeCanvas ? 2.4 : 0.3, FALL = treeCanvas ? 0.8 : 0; // open ground (desert, snow...) has nothing to chop
  const treeBase = { x: hx * TILE + TILE / 2, y: (hy + 1) * TILE };
  const chopSpot = { x: treeBase.x - 11, y: treeBase.y };
  const buildSpot = { x: hx * TILE + 22, y: (hy + 1) * TILE + 3 };
  const walkDur = clamp(Math.hypot(chopSpot.x - spawn.x, chopSpot.y - spawn.y) / 90, 2.5, 9);
  const [w, h] = houseDims(sub.tier, biome);
  const bottom = (hy + 1) * TILE, cx = hx * TILE;

  const tl = useRef({ t: 0, cleared: false, yard: false, done: false });
  const treeGroup = useRef<THREE.Group>(null!);
  const treeMat = useRef<THREE.MeshBasicMaterial>(null!);
  const siteMesh = useRef<THREE.Mesh>(null!);
  const houseMesh = useRef<THREE.Mesh>(null!);
  const houseTex = useMemo(() => { const t = texOf(houseSprite(sub.tier, biome)).clone(); t.needsUpdate = true; return t; }, [sub.tier, biome]);
  const walkStart = useMemo(() => ({ ...spawn }), [spawn]);

  const update: Updater = (_t, dt, s) => {
    const T = tl.current;
    T.t += dt;
    const t = T.t;
    const stage = t < walkDur ? 'walk' : t < walkDur + CHOP ? 'chop' : t < walkDur + CHOP + FALL ? 'fall' : 'build';
    const walkP = Math.min(1, t / walkDur);
    if (stage === 'walk') {
      s.x = walkStart.x + (chopSpot.x - walkStart.x) * walkP; s.y = walkStart.y + (chopSpot.y - walkStart.y) * walkP;
      s.flip = chopSpot.x < walkStart.x;
      s.pose = Math.floor(t / 0.2) % 2 ? 'walk0' : 'walk1';
    } else if (stage === 'chop' || stage === 'fall') {
      s.x = chopSpot.x; s.y = chopSpot.y; s.flip = false;
      s.pose = stage === 'chop' ? (Math.floor((t - walkDur) / 0.3) % 2 ? 'chop1' : 'chop0') : 'stand';
      if (!T.cleared) { T.cleared = true; forest.clearTile(hx, hy); }
    } else {
      if (!T.yard) { T.yard = true; forest.clearYard(hx, hy); }
      const bt = t - walkDur - CHOP - FALL, mv = Math.min(1, bt / 0.7);
      s.x = chopSpot.x + (buildSpot.x - chopSpot.x) * mv; s.y = chopSpot.y + (buildSpot.y - chopSpot.y) * mv;
      s.flip = false;
      s.pose = mv < 1 ? (Math.floor(bt / 0.15) % 2 ? 'walk0' : 'walk1') : Math.floor(bt / 0.25) % 2 ? 'chop1' : 'chop0';
    }
    if (treeGroup.current) {
      const ct = t - walkDur;
      treeGroup.current.visible = ct >= 0 && ct < CHOP + FALL + 0.4 && !!treeCanvas;
      if (ct < CHOP) treeGroup.current.rotation.z = Math.sin(ct * 40) * 0.025 * (ct > 0.2 ? 1 : 0);
      else {
        const f = clamp((ct - CHOP) / FALL, 0, 1);
        treeGroup.current.rotation.z = -(f * f) * Math.PI / 2;
        if (treeMat.current) treeMat.current.opacity = ct > CHOP + FALL ? 1 - (ct - CHOP - FALL) / 0.4 : 1;
      }
    }
    const bt = t - walkDur - CHOP - FALL;
    const p = clamp((bt - 0.5) / (BUILD - 0.5), 0, 1);
    if (siteMesh.current) siteMesh.current.visible = bt > 0 && p < 1;
    if (houseMesh.current) {
      houseMesh.current.visible = p > 0;
      houseTex.repeat.set(1, Math.max(0.001, p));
      houseMesh.current.scale.y = Math.max(0.001, p);
      houseMesh.current.position.y = (h * p) / 2;
    }
    if (bt >= BUILD && !T.done) { T.done = true; onDone(); }
  };

  return (
    <>
      <Villager seed={sub.id} outfit={biome} init={walkStart} update={update} />
      {treeCanvas && (
        <Bb x={treeBase.x} y={treeBase.y}>
          <group ref={treeGroup} visible={false}>
            <mesh position={[0, treeCanvas.height / 2, 0]}>
              <planeGeometry args={[treeCanvas.width, treeCanvas.height]} />
              <meshBasicMaterial ref={treeMat} map={texOf(treeCanvas)} transparent alphaTest={0.4} toneMapped={false} />
            </mesh>
          </group>
        </Bb>
      )}
      <Bb x={cx} y={bottom}>
        <mesh ref={siteMesh} position={[0, HOUSE_SIZE.site[1] / 2, -0.2]} visible={false}>
          <planeGeometry args={HOUSE_SIZE.site} />
          <meshBasicMaterial map={texOf(siteSprite('site'))} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
        <mesh ref={houseMesh} visible={false}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={houseTex} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
      </Bb>
    </>
  );
}

// ------------------------------------------------------------------ campfire clearing
function Campfire() {
  const bones = useMemo(() => bonesSprite(), []);
  const flame = useRef<THREE.MeshBasicMaterial>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const frames = useMemo(() => [0, 1, 2].map((f) => texOf(flameSprite(f))), []);
  const fx = CENTER.x * TILE, fy = CENTER.y * TILE;
  const sitL = useMemo<Updater>(() => (_t, _d, s) => { s.pose = 'sit'; s.flip = false; }, []);
  const sitR = useMemo<Updater>(() => (_t, _d, s) => { s.pose = 'sit'; s.flip = true; }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    flame.current.map = frames[Math.floor(t * 7) % 3];
    glow.current.scale.setScalar(300 * (1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02));
  });
  return (
    <>
      <mesh ref={glow} position={[fx, -fy, 0.3]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texOf(glowSprite())} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Bb x={fx} y={fy}>
        <mesh position={[0, 8, 0]}>
          <planeGeometry args={[12, 16]} />
          <meshBasicMaterial ref={flame} transparent alphaTest={0.3} toneMapped={false} />
        </mesh>
      </Bb>
      <Villager seed={2} outfit="lime" init={{ x: fx - 17, y: fy + 6 }} update={sitL} />
      <Villager seed={5} outfit="lime" init={{ x: fx + 17, y: fy + 6 }} update={sitR} />
      <Sprite canvas={bones} x={MUD.x * TILE} y={MUD.y * TILE} w={40} h={14} />
    </>
  );
}

// ------------------------------------------------------------------ fireflies
function Fireflies() {
  const N = 260, SPAN = 2400;
  const data = useMemo(() => {
    const base = new Float32Array(N * 3), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { base[i * 3] = Math.random() * SPAN; base[i * 3 + 1] = Math.random() * SPAN; base[i * 3 + 2] = Math.random() * 100; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { base, pos, geo };
  }, []);
  const mat = useRef<THREE.PointsMaterial>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime, { base, pos, geo } = data, cam = state.camera.position;
    const cx = cam.x, cy = -(cam.y + 2000 * Math.sin(TILT));
    for (let i = 0; i < N; i++) {
      const ph = base[i * 3 + 2];
      // fixed in the world, wrapped around the camera so there are always fireflies on screen
      const wx = base[i * 3] + Math.sin(t * 0.4 + ph) * 18, wy = base[i * 3 + 1] + Math.cos(t * 0.35 + ph * 2) * 14;
      pos[i * 3] = cx + ((((wx - cx + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;
      pos[i * 3 + 1] = -(cy + ((((wy - cy + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2);
      pos[i * 3 + 2] = 8 + (Math.sin(t * 0.5 + ph) + 1) * 9;
    }
    geo.attributes.position.needsUpdate = true;
    mat.current.opacity = 0.65 + Math.sin(t * 2.1) * 0.3;
  });
  return (
    <points geometry={data.geo} frustumCulled={false}>
      <pointsMaterial ref={mat} color="#d9ff7a" size={3} sizeAttenuation={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// ------------------------------------------------------------------ farmland: barn, windmill, scarecrows, farmers
function Farmland() {
  const sc = useMemo(() => scarecrow(), []);
  const hay = useMemo(() => hayBale(), []);
  const barn = useMemo(() => barnSprite(), []);
  const tower = useMemo(() => windmillTower(), []);
  const sails = useMemo(() => texOf(windmillSails()), []);
  const sailsRef = useRef<THREE.Mesh>(null!);
  useFrame((_s, dt) => { sailsRef.current.rotation.z -= Math.min(dt, 0.1) * 0.9; });
  const bx = (BARN.x + 0.5) * TILE, by = (BARN.y + 1) * TILE;
  const wx = (WINDMILL.x + 0.5) * TILE, wy = (WINDMILL.y + 1) * TILE;
  const farmers = useMemo(() => FARMS.map((f, i) => {
    const fx = (f.x0 + 1.5 + (i % 3) * 2) * TILE, fy = (f.y0 + f.h - 1.5) * TILE;
    const upd: Updater = (t, _d, s) => { s.pose = Math.floor((t + i) / 0.35) % 2 ? 'chop1' : 'chop0'; s.flip = i % 2 === 0; };
    return { fx, fy, upd, seed: 20 + i };
  }), []);
  return (
    <>
      <Sprite canvas={barn} x={bx} y={by} w={44} h={38} />
      <Sprite canvas={tower} x={wx} y={wy} w={28} h={46} />
      <Bb x={wx} y={wy}>
        <mesh ref={sailsRef} position={[0, 33, 0.3]}>
          <planeGeometry args={[48, 48]} />
          <meshBasicMaterial map={sails} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
      </Bb>
      {FARMS.map((f, i) => (
        <group key={i}>
          <Sprite canvas={sc} x={(f.x0 + Math.floor(f.w / 2) + 0.5) * TILE} y={(f.y0 + Math.floor(f.h / 2) + 1) * TILE} w={14} h={20} />
          <Sprite canvas={hay} x={(f.x0 + f.w - 0.5) * TILE} y={(f.y0 + f.h) * TILE} w={14} h={11} />
        </group>
      ))}
      {farmers.map((f, i) => <Villager key={i} seed={f.seed} outfit="lime" init={{ x: f.fx, y: f.fy }} update={f.upd} />)}
    </>
  );
}

// ------------------------------------------------------------------ rocket launch complex
const RX = (ROCKET.x + 0.5) * TILE, RY = (ROCKET.y + 1) * TILE;
function LaunchComplex({ signal, arrival, ctl, onStart, onLifted, onLanded }: {
  signal: number; arrival: boolean; ctl: React.MutableRefObject<CamCtl>; onStart: () => void; onLifted: () => void; onLanded: () => void;
}) {
  const gantry = useMemo(() => gantrySprite(), []);
  const tank = useMemo(() => tankSprite(), []);
  const control = useMemo(() => controlBuilding(), []);
  const beacon = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((s) => { beacon.current.opacity = Math.sin(s.clock.elapsedTime * 4) > 0 ? 1 : 0.2; });
  return (
    <>
      <Sprite canvas={gantry} x={RX - 30} y={RY - 1} w={30} h={84} />
      <Bb x={RX - 19} y={RY - 1}>
        <mesh position={[0, 82, 0.5]}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial ref={beacon} color="#ff3030" transparent toneMapped={false} />
        </mesh>
      </Bb>
      {[0, 1].map((i) => <Sprite key={i} canvas={tank} x={RX + 44 + i * 28} y={RY + 14} w={24} h={36} />)}
      <Sprite canvas={control} x={RX - 90} y={RY + 56} w={52} h={34} />
      <RocketActor x={RX} y={RY} signal={signal} arrival={arrival} lowG={false} ctl={ctl} dust="236,226,206" reentry
        onStart={onStart} onLifted={onLifted} onLanded={onLanded} />
    </>
  );
}

// ------------------------------------------------------------------ root
export interface Entry { sub: SubscriberDTO; mode: 'built' | 'anim'; spawn?: { x: number; y: number } }

export default function Scene({ forest, entries, tierOf, selected, onSelect, onBuilt, launchSignal, arrival, onLaunchStart, onLifted, onLanded }: {
  forest: EarthWorld; entries: Entry[]; tierOf: (s: SubscriberDTO) => Tier; selected: SubscriberDTO | null;
  onSelect: (s: SubscriberDTO | null) => void; onBuilt: (id: number) => void;
  launchSignal: number; arrival: boolean; onLaunchStart: () => void; onLifted: () => void; onLanded: () => void;
}) {
  const ctl = useRef<CamCtl>({ focus: null });
  const houses = useMemo(() => entries.map((e) => e.sub), [entries]);
  const points = useMemo(() => houses.map((h) => ({ x: h.x * TILE, y: h.y * TILE })), [houses]);
  const built = useMemo(() => entries.filter((e) => e.mode === 'built').map((e) => e.sub), [entries]);
  const groups = useMemo(() => {
    const g = new Map<string, { tier: Tier; biome: Biome; subs: SubscriberDTO[] }>();
    for (const s of built) {
      const tier = tierOf(s), biome = biomeOf(s), k = `${tier}|${biome}`;
      if (!g.has(k)) g.set(k, { tier, biome, subs: [] });
      g.get(k)!.subs.push(s);
    }
    return [...g.entries()];
  }, [built, tierOf]);
  const residents = useMemo(() => built.slice(0, MAX_RESIDENTS), [built]);
  const popupAt = selected ? { x: selected.x * TILE, y: (selected.y + 1) * TILE, h: houseDims(tierOf(selected), biomeOf(selected))[1] } : null;
  useEffect(() => { void TILT; }, []);
  return (
    <Canvas
      orthographic
      camera={{ position: [CENTER.x * TILE, -CENTER.y * TILE - 1000, 1000], zoom: 3, near: 1, far: 5000 }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      dpr={[1, 1.5]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#0a1a14']} />
      <WorldLayer manager={forest.manager} falls />
      <Farmland />
      <Campfire />
      <LaunchComplex signal={launchSignal} arrival={arrival} ctl={ctl} onStart={onLaunchStart} onLifted={onLifted} onLanded={onLanded} />
      <HouseShadows subs={built} />
      {groups.map(([k, g]) => (
        <HouseInstances key={k} tier={g.tier} biome={g.biome} subs={g.subs} selectedId={selected?.id ?? null} onSelect={onSelect} />
      ))}
      {residents.map((s) => <Resident key={s.id} sub={s} />)}
      {entries.filter((e) => e.mode === 'anim').map((e) => (
        <Builder key={e.sub.id} sub={e.sub} spawn={e.spawn!} forest={forest} onDone={() => onBuilt(e.sub.id)} />
      ))}
      <Fireflies />
      <CameraRig points={points} anchor={{ x: CENTER.x * TILE, y: CENTER.y * TILE }} minExtent={26 * TILE} pad={9 * TILE} popupAt={popupAt} ctl={ctl} />
    </Canvas>
  );
}
