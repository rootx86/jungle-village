'use client';
// The Moon colony: premium members and subscribers of a year or more, all in space suits.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE, MOON_PAD, MOON_CENTER, type SubscriberDTO, type Tier } from '@shared';
import { dishSprite, flagSprite, habitatSprite, roverSprite, solarArray } from '../lib/art4';
import { MoonWorld } from '../lib/moonworld';
import WorldLayer from './WorldLayer';
import { texOf } from '../lib/tex';
import { Bb, CameraRig, Sprite, Villager, blobShadow, makeWanderer, standMatrix, type CamCtl } from './common';
import RocketActor from './Rocket';

const HAB_H: Record<Tier, number> = { hut: 26, house: 30, cottage: 34, manor: 44 };
const HAB_W: Record<Tier, number> = { hut: 30, house: 36, cottage: 40, manor: 52 };
const PX = MOON_PAD.x * TILE, PY = MOON_PAD.y * TILE;
const TIER_LIST: Tier[] = ['hut', 'house', 'cottage', 'manor'];

function Habitats({ tier, subs, selectedId, onSelect }: { tier: Tier; subs: SubscriberDTO[]; selectedId: number | null; onSelect: (s: SubscriberDTO) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const h = HAB_H[tier], w = HAB_W[tier];
  const cap = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, subs.length))));
  const tex = useMemo(() => texOf(habitatSprite(tier)), [tier]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    subs.forEach((sub, i) => {
      m.setMatrixAt(i, standMatrix(sub.moon!.x * TILE, (sub.moon!.y + 1) * TILE));
      m.setColorAt(i, c.setScalar(sub.id === selectedId ? 1.45 : 1));
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

/** Hard, long shadows (no atmosphere on the Moon). */
function HabitatShadows({ subs, tierOf }: { subs: SubscriberDTO[]; tierOf: (s: SubscriberDTO) => Tier }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const cap = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, subs.length))));
  const tex = useMemo(() => blobShadow(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    subs.forEach((s, i) => {
      const t = tierOf(s), w = HAB_W[t], h = HAB_H[t];
      o.position.set(s.moon!.x * TILE + w * 0.45, -((s.moon!.y + 1) * TILE) - 2, 0.1); o.rotation.set(0, 0, -0.05); o.scale.set(w * 1.9, h * 0.55, 1); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = subs.length; m.instanceMatrix.needsUpdate = true;
  }, [subs, tierOf, cap]);
  return (
    <instancedMesh key={cap} ref={ref} args={[undefined, undefined, cap]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.9} />
    </instancedMesh>
  );
}

function Colonist({ sub }: { sub: SubscriberDTO }) {
  const home = useMemo(() => ({ x: sub.moon!.x * TILE - 4 + (sub.id % 5) * 2, y: (sub.moon!.y + 1) * TILE + 8 }), [sub]);
  const update = useMemo(() => makeWanderer(home, 64), [home]);
  return <Villager seed={sub.id} outfit="space" init={home} update={update} />;
}

function Rover() {
  const grp = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const frames = useMemo(() => [0, 1].map((f) => texOf(roverSprite(f))), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.25, x = PX - 250 + Math.sin(t) * 200, y = PY - 150 + Math.cos(t * 0.7) * 24;
    grp.current.position.set(x, -y, 0);
    mesh.current.scale.x = Math.cos(t) > 0 ? 1 : -1;
    mat.current.map = frames[Math.floor(state.clock.elapsedTime * 6) % 2];
  });
  return (
    <group ref={grp}>
      <group rotation={[0.62, 0, 0]}>
        <mesh ref={mesh} position={[0, 9, 0]}>
          <planeGeometry args={[30, 18]} />
          <meshBasicMaterial ref={mat} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Blink() {
  const mats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  useFrame((s) => { mats.current.forEach((m, i) => { if (m) m.opacity = Math.sin(s.clock.elapsedTime * 3 + i * 1.7) > 0.2 ? 1 : 0.15; }); });
  const pts = useMemo(() => Array.from({ length: 16 }, (_, a) => { const t = (a / 16) * 6.28, r = (MOON_PAD.r * TILE) - 6; return [PX + Math.cos(t) * r, PY + Math.sin(t) * r] as const; }), []);
  return (
    <>
      {pts.map(([x, y], i) => (
        <mesh key={i} position={[x, -y, 0.4]}>
          <planeGeometry args={[5, 5]} />
          <meshBasicMaterial ref={(m) => { mats.current[i] = m; }} color="#7fd8ff" transparent toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

export default function MoonScene({ colonists, tierOf, selected, onSelect, returnSignal, arrival, onReturnStart, onLifted, onLanded }: {
  colonists: SubscriberDTO[]; tierOf: (s: SubscriberDTO) => Tier; selected: SubscriberDTO | null;
  onSelect: (s: SubscriberDTO | null) => void; returnSignal: number; arrival: boolean;
  onReturnStart: () => void; onLifted: () => void; onLanded: () => void;
}) {
  const ctl = useRef<CamCtl>({ focus: null });
  const world = useMemo(() => { const w = new MoonWorld(); w.init(); return w; }, []);
  const groups = useMemo(() => TIER_LIST.map((t) => ({ tier: t, subs: colonists.filter((c) => tierOf(c) === t) })), [colonists, tierOf]);
  const points = useMemo(() => [{ x: PX, y: PY + 20 }, ...colonists.map((c) => ({ x: c.moon!.x * TILE, y: c.moon!.y * TILE }))], [colonists]);
  const props = useMemo(() => ({ solar: solarArray(), dish: dishSprite(), flag: flagSprite() }), []);
  const popupAt = selected?.moon ? { x: selected.moon.x * TILE, y: (selected.moon.y + 1) * TILE, h: HAB_H[tierOf(selected)] } : null;
  const residents = useMemo(() => colonists.slice(0, 160), [colonists]);
  return (
    <Canvas
      orthographic
      camera={{ position: [PX, -PY - 1000, 1000], zoom: 3, near: 1, far: 5000 }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      dpr={[1, 1.5]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#05060c']} />
      <WorldLayer manager={world.manager} />
      <Blink />
      <RocketActor x={PX} y={PY} signal={returnSignal} arrival={arrival} lowG ctl={ctl} dust="190,190,200" reentry={false}
        onStart={onReturnStart} onLifted={onLifted} onLanded={onLanded} />
      <Sprite canvas={props.flag} x={PX + 160} y={PY - 30} w={20} h={30} />
      <Sprite canvas={props.dish} x={PX - 190} y={PY - 60} w={30} h={32} />
      <Sprite canvas={props.solar} x={PX + 210} y={PY + 70} w={40} h={22} />
      <Sprite canvas={props.solar} x={PX + 256} y={PY + 70} w={40} h={22} />
      <Sprite canvas={props.solar} x={PX - 230} y={PY + 80} w={40} h={22} />
      <Rover />
      <HabitatShadows subs={colonists} tierOf={tierOf} />
      {groups.map((g) => g.subs.length > 0 && <Habitats key={g.tier} tier={g.tier} subs={g.subs} selectedId={selected?.id ?? null} onSelect={onSelect} />)}
      {residents.map((c) => <Colonist key={c.id} sub={c} />)}
      <CameraRig points={points} anchor={{ x: MOON_CENTER.x * TILE, y: MOON_CENTER.y * TILE }} minExtent={30 * TILE} pad={9 * TILE} popupAt={popupAt} ctl={ctl} />
    </Canvas>
  );
}
void Bb;
