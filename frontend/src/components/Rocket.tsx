'use client';
// The rocket: sits on a pad (click to launch), lifts off with fire and smoke, or comes down on its engines
// and lands (Earth return: with a re-entry glow; Moon: slower, floatier, with a dust blast).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { flameSprite2, rocketSprite } from '../lib/art4';
import { softBlob } from '../lib/art';
import { texOf } from '../lib/tex';
import { Bb, CS, TILT, type CamCtl } from './common';

type Phase = 'idle' | 'ignite' | 'lift' | 'gone' | 'descend' | 'settle';
const PUFFS = 20;

export default function RocketActor({ x, y, signal, arrival, lowG, ctl, onStart, onLifted, onLanded, dust, reentry }: {
  x: number; y: number;                 // ground px of the pad (rocket base)
  signal: number;                       // raise to launch
  arrival: boolean;                     // true: start high above and land
  lowG: boolean;                        // Moon: floatier flight
  ctl: React.MutableRefObject<CamCtl>;
  onStart?: () => void; onLifted?: () => void; onLanded?: () => void;
  dust: string; reentry: boolean;
}) {
  const rocket = useMemo(() => texOf(rocketSprite()), []);
  const flames = useMemo(() => [0, 1, 2].map((f) => texOf(flameSprite2(f))), []);
  const blob = useMemo(() => texOf(softBlob(dust, 0.9)), [dust]);
  const heat = useMemo(() => texOf(softBlob('255,150,60', 1)), []);
  const glowT = useMemo(() => texOf(softBlob('255,190,90', 1)), []);
  const body = useRef<THREE.Mesh>(null!);
  const flame = useRef<THREE.Mesh>(null!);
  const flameMat = useRef<THREE.MeshBasicMaterial>(null!);
  const heatMesh = useRef<THREE.Mesh>(null!);
  const padGlow = useRef<THREE.Mesh>(null!);
  const puffs = useRef<Array<THREE.Mesh | null>>([]);
  const S = useRef({
    phase: (arrival ? 'descend' : 'idle') as Phase, t: 0, spawn: 0, n: 0,
    life: new Float32Array(PUFFS), vx: new Float32Array(PUFFS), vy: new Float32Array(PUFFS), px: new Float32Array(PUFFS), py: new Float32Array(PUFFS),
  });
  const begun = useRef(signal); // only signals raised after mount launch the rocket
  const IGNITE = 1.9, LIFT = lowG ? 3.4 : 3.0, DESCEND = lowG ? 5.2 : 4.6, H0 = lowG ? 900 : 1100, ACC = lowG ? 120 : 150;

  const emit = (outward: number, upward: number, spread: number) => {
    const s = S.current, i = s.n++ % PUFFS;
    const a = Math.random() * Math.PI * 2;
    s.px[i] = (Math.random() - 0.5) * spread; s.py[i] = 2 + Math.random() * 4;
    s.vx[i] = Math.cos(a) * outward * (0.4 + Math.random()); s.vy[i] = upward * (0.3 + Math.random());
    s.life[i] = 1.8;
  };

  const start = () => {
    if (S.current.phase !== 'idle') return;
    S.current.phase = 'ignite'; S.current.t = 0;
    ctl.current.focus = { x, y: y - 30 / CS, z: 3.6 };
    onStart?.();
  };
  useEffect(() => { if (signal > begun.current) { begun.current = signal; start(); } }); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dtRaw) => {
    const s = S.current, dt = Math.min(dtRaw, 0.1), t = state.clock.elapsedTime;
    if (s.phase !== 'idle' && s.phase !== 'gone') s.t += dt;
    let oy = 0, power = 0;
    if (s.phase === 'ignite') {
      power = Math.min(1, s.t / IGNITE) * 0.6;
      if (s.t > IGNITE) { s.phase = 'lift'; s.t = 0; }
    }
    if (s.phase === 'lift') {
      oy = 0.5 * ACC * s.t * s.t; power = 1;
      ctl.current.focus = { x, y: y - (30 + oy * 0.9) / CS, z: Math.max(2.2, 3.6 - s.t * 0.5) };
      if (s.t > LIFT) { s.phase = 'gone'; onLifted?.(); }
    }
    if (s.phase === 'descend') {
      const f = Math.max(0, 1 - s.t / DESCEND);
      oy = H0 * f * f; power = oy > 6 ? 1 : 0.3;
      ctl.current.focus = { x, y: y - (30 + oy * 0.9) / CS, z: Math.min(3.4, 2.2 + s.t * 0.3) };
      if (oy > 4 && s.t > DESCEND - 1.6) { s.spawn += dt; if (s.spawn > 0.04) { s.spawn = 0; emit(160, 5, 30); } }
      if (s.t >= DESCEND) { s.phase = 'settle'; s.t = 0; for (let i = 0; i < PUFFS; i++) emit(lowG ? 120 : 90, 4, 20); }
    }
    if (s.phase === 'settle') {
      power = 0;
      if (s.t > 1.2) { s.phase = 'idle'; ctl.current.focus = null; onLanded?.(); }
    }
    body.current.visible = s.phase !== 'gone';
    body.current.position.y = 32 + oy;
    const burning = power > 0.05 && s.phase !== 'gone';
    flame.current.visible = burning;
    flame.current.position.y = oy - 12;
    flame.current.scale.set(0.5 + power * 0.7, 0.4 + power * 1.0, 1);
    flameMat.current.map = flames[Math.floor(t * 18) % 3];
    padGlow.current.visible = burning && oy < 220;
    (padGlow.current.material as THREE.MeshBasicMaterial).opacity = (0.35 + power * 0.5) * Math.max(0, 1 - oy / 220);
    if (reentry) {
      heatMesh.current.visible = s.phase === 'descend' && oy > 150;
      (heatMesh.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, Math.max(0, (oy - 150) / 700));
      heatMesh.current.position.y = 32 + oy + 20;
    }
    if (s.phase === 'ignite' || s.phase === 'lift') {
      s.spawn += dt;
      if (s.spawn > 0.05) { s.spawn = 0; emit(s.phase === 'lift' ? 150 : 90, 8, 24); }
    }
    puffs.current.forEach((m, i) => {
      if (!m) return;
      if (s.life[i] > 0) {
        s.life[i] -= dt;
        const a = Math.max(0, s.life[i] / 1.8);
        s.px[i] += s.vx[i] * dt; s.py[i] += s.vy[i] * dt;
        m.visible = true; m.position.set(s.px[i], s.py[i], 0.2);
        m.scale.setScalar(22 + (1 - a) * 70);
        (m.material as THREE.MeshBasicMaterial).opacity = a * 0.75;
      } else m.visible = false;
    });
  });

  return (
    <>
      <mesh position={[x, -y, 0.3]} ref={padGlow} visible={false}>
        <planeGeometry args={[150, 150]} />
        <meshBasicMaterial map={glowT} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Bb x={x} y={y}>
        <mesh
          ref={body}
          onClick={(e: ThreeEvent<MouseEvent>) => { if (e.delta < 6 && S.current.phase === 'idle') { e.stopPropagation(); start(); } }}
          onPointerOver={() => { if (S.current.phase === 'idle') document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          <planeGeometry args={[24, 64]} />
          <meshBasicMaterial map={rocket} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
        <mesh ref={flame} visible={false} position={[0, -12, -0.3]}>
          <planeGeometry args={[20, 40]} />
          <meshBasicMaterial ref={flameMat} transparent alphaTest={0.3} toneMapped={false} />
        </mesh>
        <mesh ref={heatMesh} visible={false}>
          <planeGeometry args={[110, 110]} />
          <meshBasicMaterial map={heat} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Bb>
      <Bb x={x} y={y + 6}>
        {Array.from({ length: PUFFS }, (_, i) => (
          <mesh key={i} ref={(m) => { puffs.current[i] = m; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={blob} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </Bb>
    </>
  );
}
void TILT;
