'use client';
// Wildlife, farm animals and sailing ships. Everything is simulated on the client, around the camera only:
// animals are generated deterministically per chunk (wildlifeInChunk) plus two animals at every home.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE, CHUNK_TILES as CT, hash2, biomeAt, isWater, isOcean, isMountain, isRock, type SubscriberDTO } from '@shared';
import { buildAtlas, dynamicSprites } from '../lib/atlas';
import { ANIMAL_CELL, DOMESTIC, SPECIES, SPECIES_LIST, VESSEL_CELL, animalSprite, vesselSprite, wildlifeInChunk } from '../lib/animals';
import { SN, TILT, blobShadow } from './common';

const MAXA = 420, MAXV = 70;
interface A {
  id: string; species: string; vessel: boolean; kind: string; move: string; speed: number; w: number; h: number;
  x: number; y: number; hx: number; hy: number; home: boolean; dir: number; wait: number; turn: number; t: number; moving: boolean; seed: number;
}

const walkable = (px: number, py: number) => {
  const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
  return !isWater(x, y) && !isMountain(x, y) && !isRock(x, y);
};

export default function Animals({ houses }: { houses: SubscriberDTO[] }) {
  const housesRef = useRef(houses); housesRef.current = houses;
  const active = useRef(new Map<string, A>());
  const clock = useRef(0);
  const lastRefresh = useRef(-1);
  const layers = useMemo(() => {
    const an = buildAtlas(SPECIES_LIST.flatMap((s) => [animalSprite(s, 0), animalSprite(s, 1)]), ANIMAL_CELL[0], ANIMAL_CELL[1], 8);
    const vs = buildAtlas([vesselSprite('ship', 0), vesselSprite('ship', 1), vesselSprite('boat', 0), vesselSprite('boat', 1)], VESSEL_CELL[0], VESSEL_CELL[1], 4);
    const animals = dynamicSprites(an, MAXA), vessels = dynamicSprites(vs, MAXV);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false, toneMapped: false }), MAXA + MAXV);
    shadows.frustumCulled = false; shadows.count = 0;
    return { an, vs, animals, vessels, shadows, o: new THREE.Object3D() };
  }, []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), cam = state.camera as THREE.OrthographicCamera, A = active.current;
    clock.current += dt;
    // ---- keep the set of animals near the camera up to date (twice a second)
    if (lastRefresh.current < 0 || clock.current - lastRefresh.current > 0.5) {
      lastRefresh.current = clock.current;
      const z = cam.zoom, px = cam.position.x, py = -(cam.position.y + 2000 * SN);
      const halfW = state.size.width / 2 / z + 160, halfH = state.size.height / 2 / (z * Math.cos(TILT)) + 220;
      const seen = new Set<string>();
      let na = 0, nv = 0;
      for (const a of A.values()) a.vessel ? nv++ : na++;
      const add = (id: string, species: string, x: number, y: number, home?: { x: number; y: number }) => {
        seen.add(id);
        if (A.has(id)) return;
        const sp = species === 'ship' || species === 'boat' ? null : SPECIES[species];
        const vessel = !sp;
        if (vessel ? nv >= MAXV : na >= MAXA) return;
        vessel ? nv++ : na++;
        const seed = hash2(x | 0, y | 0, 600);
        A.set(id, {
          id, species, vessel, kind: species, move: vessel ? 'sea' : sp!.move, speed: vessel ? (species === 'ship' ? 15 : 11) : sp!.speed, w: vessel ? (species === 'ship' ? 38 : 20) : sp!.w, h: vessel ? (species === 'ship' ? 8 : 5) : sp!.h,
          x, y, hx: home?.x ?? x, hy: home?.y ?? y, home: !!home, dir: seed * 6.28, wait: seed * 3, turn: 1 + seed * 4, t: seed * 10, moving: false, seed,
        });
      };
      for (let cy = Math.floor((py - halfH) / (CT * TILE)); cy <= Math.floor((py + halfH) / (CT * TILE)); cy++)
        for (let cx = Math.floor((px - halfW) / (CT * TILE)); cx <= Math.floor((px + halfW) / (CT * TILE)); cx++)
          for (const s of wildlifeInChunk(cx, cy)) add(s.id, s.species, s.x, s.y);
      for (const h of housesRef.current) {
        const hx = h.x * TILE, hy = (h.y + 1) * TILE + 14;
        if (Math.abs(hx - px) > halfW || Math.abs(hy - py) > halfH) continue;
        const list = DOMESTIC[biomeAt(h.x, h.y)];
        for (let i = 0; i < 2; i++) add(`h${h.id}:${i}`, list[Math.floor(hash2(h.id, i, 610) * list.length)], hx + (hash2(h.id, i, 611) - 0.5) * 70, hy + hash2(h.id, i, 612) * 30, { x: hx, y: hy });
      }
      for (const id of [...A.keys()]) if (!seen.has(id)) A.delete(id);
    }

    // ---- simulate and draw
    const { animals, vessels, shadows, o, an, vs } = layers;
    let ia = 0, iv = 0, is = 0;
    for (const a of A.values()) {
      a.t += dt;
      a.moving = false;
      if (a.move === 'air') {
        a.x += Math.cos(a.dir) * a.speed * dt; a.y += Math.sin(a.dir) * a.speed * dt * 0.8; a.dir += Math.sin(a.t * 0.6 + a.seed * 9) * 0.004; a.moving = true;
      } else if (a.wait > 0) a.wait -= dt;
      else {
        a.turn -= dt;
        if (a.turn <= 0) { a.dir = Math.random() * 6.28; a.turn = 2 + Math.random() * 5; if (a.move !== 'sea' && Math.random() < 0.4) a.wait = 1 + Math.random() * 3; }
        const step = a.speed * dt, ca = Math.cos(a.dir), sa = Math.sin(a.dir);
        if (a.home && Math.hypot(a.x - a.hx, a.y - a.hy) > 85) a.dir = Math.atan2(a.hy - a.y, a.hx - a.x);
        const ahead = (d: number) => [a.x + ca * d, a.y + sa * d] as const;
        const [lx, ly] = ahead(a.move === 'sea' ? 40 : 10);
        const ok = a.move === 'sea' ? isOcean(Math.floor(lx / TILE), Math.floor(ly / TILE)) || isWater(Math.floor(lx / TILE), Math.floor(ly / TILE))
          : a.move === 'water' ? isWater(Math.floor(lx / TILE), Math.floor(ly / TILE))
          : walkable(lx, ly);
        if (ok) { a.x += ca * step; a.y += sa * step; a.moving = true; } else { a.dir += Math.PI * (0.6 + Math.random() * 0.8); a.turn = 1.5; }
      }
      const frame = a.moving ? Math.floor(a.t * (a.move === 'air' ? 7 : a.vessel ? 1.4 : 5)) % 2 : 0;
      const flip = Math.cos(a.dir) < 0 ? -1 : 1;
      const lift = a.move === 'air' ? 54 : 0, bob = a.vessel ? Math.sin(a.t * 1.6 + a.seed * 9) * 0.8 : 0;
      o.position.set(a.x, -a.y + lift * Math.cos(TILT) + bob, lift * Math.sin(TILT)); o.rotation.set(TILT, 0, 0); o.scale.set(flip, 1, 1); o.updateMatrix();
      if (a.vessel) {
        if (iv >= MAXV) continue;
        const k = ((a.kind === 'ship' ? 0 : 2) + frame) * 4;
        vessels.mesh.setMatrixAt(iv, o.matrix); vessels.uv.setXYZW(iv, vs.uv[k], vs.uv[k + 1], vs.uv[k + 2], vs.uv[k + 3]); iv++;
      } else {
        if (ia >= MAXA) continue;
        const k = (SPECIES_LIST.indexOf(a.species) * 2 + frame) * 4;
        animals.mesh.setMatrixAt(ia, o.matrix); animals.uv.setXYZW(ia, an.uv[k], an.uv[k + 1], an.uv[k + 2], an.uv[k + 3]); ia++;
      }
      o.position.set(a.x + 3, -a.y - 1, 0.1); o.rotation.set(0, 0, 0); o.scale.set(a.w + 4, a.h * 0.55 + 3, 1); o.updateMatrix();
      shadows.setMatrixAt(is++, o.matrix);
    }
    animals.mesh.count = ia; vessels.mesh.count = iv; shadows.count = is;
    animals.mesh.instanceMatrix.needsUpdate = true; animals.uv.needsUpdate = true;
    vessels.mesh.instanceMatrix.needsUpdate = true; vessels.uv.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={layers.shadows} />
      <primitive object={layers.animals.mesh} />
      <primitive object={layers.vessels.mesh} />
    </>
  );
}
