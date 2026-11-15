'use client';
// Streams chunks of an infinite world around the camera and keeps the waterfall texture flowing.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CHUNK_TILES, TILE } from '@shared';
import type { ChunkBase, ChunkManager } from '../lib/chunks';
import { fallTexture3 } from '../lib/earth';
import { CS, SN } from './common';

const CHUNK_PX = CHUNK_TILES * TILE;

export default function WorldLayer<C extends ChunkBase>({ manager, falls = false }: { manager: ChunkManager<C>; falls?: boolean }) {
  const { camera, size } = useThree();
  const first = useRef(true);
  useEffect(() => () => { manager.disposeAll(); }, [manager]);
  useFrame((_s, dt) => {
    const oc = camera as THREE.OrthographicCamera;
    const z = oc.zoom, px = oc.position.x, py = -(oc.position.y + 2000 * SN);
    const halfW = size.width / 2 / z, halfH = size.height / 2 / (z * CS);
    // tall sprites (mountains, trees) stand up out of their chunk: pull in an extra chunk to the south
    const x0 = Math.floor((px - halfW) / CHUNK_PX) - 1, x1 = Math.floor((px + halfW) / CHUNK_PX) + 1;
    const y0 = Math.floor((py - halfH) / CHUNK_PX) - 1, y1 = Math.floor((py + halfH) / CHUNK_PX) + 2;
    manager.update(x0, y0, x1, y1, first.current ? 40 : 7);
    first.current = false;
    if (falls) { const t = fallTexture3(); t.offset.y += Math.min(dt, 0.1) * 0.9; }
  });
  return <primitive object={manager.root} />;
}
