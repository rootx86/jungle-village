// Villagers dress for the biome their house is in; Moon colonists wear space suits.
import type { Biome } from '@shared';
import { mk, rect, type Cvs, type Pose } from './art';

export type Outfit = Biome | 'space';

type Head = 'none' | 'strawhat' | 'hood' | 'turban' | 'helmet' | 'cap' | 'bun' | 'beanie' | 'furhood' | 'spacehelmet';
type Extra = 'none' | 'backpack' | 'robe' | 'cloak' | 'poncho' | 'sash' | 'scarf' | 'parka' | 'flowers' | 'spacepack';
interface Style { shirt: string; shirt2: string; pants: string; boots: string; head: Head; c1: string; c2: string; extra: Extra }

const STYLES: Record<Outfit, Style> = {
  emerald:  { shirt: '#3f8a4a', shirt2: '#2c6a38', pants: '#5a4630', boots: '#2a1a10', head: 'cap', c1: '#6a4a2a', c2: '#d8342c', extra: 'none' },
  golden:   { shirt: '#d9791f', shirt2: '#b05a14', pants: '#4a3a2a', boots: '#2a1a10', head: 'beanie', c1: '#a0522d', c2: '#c0392b', extra: 'scarf' },
  blossom:  { shirt: '#f08ab4', shirt2: '#d46a98', pants: '#e8d8e0', boots: '#7a4a5a', head: 'bun', c1: '#ff6a9a', c2: '#ffffff', extra: 'sash' },
  blue:     { shirt: '#2e7d9a', shirt2: '#1f5a74', pants: '#2a3a4a', boots: '#1a1a20', head: 'hood', c1: '#1f5a74', c2: '#3a8aa8', extra: 'cloak' },
  lime:     { shirt: '#8ac24a', shirt2: '#6aa238', pants: '#6a5a3a', boots: '#3a2a18', head: 'strawhat', c1: '#f0d878', c2: '#e8c860', extra: 'none' },
  snow:     { shirt: '#f2f6fa', shirt2: '#b8c4d0', pants: '#4a5a78', boots: '#3a3a44', head: 'furhood', c1: '#e8eef4', c2: '#b4bcc8', extra: 'parka' },
  desert:   { shirt: '#d8b878', shirt2: '#b8985a', pants: '#d8b878', boots: '#6a4a2a', head: 'turban', c1: '#f2ead8', c2: '#b84a3a', extra: 'robe' },
  swamp:    { shirt: '#4a6a3a', shirt2: '#34502a', pants: '#3a3020', boots: '#2a2418', head: 'hood', c1: '#3a5a2e', c2: '#5a7a44', extra: 'poncho' },
  tropical: { shirt: '#ff6a3a', shirt2: '#ffe050', pants: '#f2e8c8', boots: '#a8682a', head: 'strawhat', c1: '#e8c868', c2: '#ff5a8a', extra: 'flowers' },
  mountain: { shirt: '#b8602a', shirt2: '#8a4418', pants: '#4a4a52', boots: '#2a2a30', head: 'helmet', c1: '#f2c230', c2: '#fff6c0', extra: 'backpack' },
  space:    { shirt: '#f4f6fa', shirt2: '#c8ccd4', pants: '#e4e8ee', boots: '#7a808a', head: 'spacehelmet', c1: '#cfe8f5', c2: '#d8b04a', extra: 'spacepack' },
};
const HAIR = ['#2b1b12', '#6b3a1e', '#c9a13a', '#1e2f5a', '#a8362e', '#e8e8f0', '#3a7a4a'];
const PATCH = ['#e04a3a', '#3a8ae0', '#e0b030', '#3ab870', '#a85ad8', '#ee7a3a'];

const cache = new Map<string, Cvs>();
export function villagerSprite(seed: number, pose: Pose, outfit?: Outfit): Cvs {
  const key = `${seed % 7}|${seed % 6}|${pose}|${outfit ?? 'plain'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const st = STYLES[outfit ?? 'emerald'];
  const hair = HAIR[seed % HAIR.length];
  const c = mk(18, 18), g = c.getContext('2d')!;
  const o = 3, sit = pose === 'sit', dy = sit ? 3 : 0;
  const space = outfit === 'space';

  // backpack / cloak parts that sit behind the body
  if (st.extra === 'backpack') rect(g, o - 1, 6 + dy, 3, 5, '#6a5a4a');
  if (st.extra === 'spacepack') { rect(g, o - 1, 5 + dy, 3, 6, '#c8ccd4'); rect(g, o - 1, 6 + dy, 1, 2, '#e04a3a'); }
  if (st.extra === 'cloak') rect(g, o + 1, 6 + dy, 8, 6, st.shirt2);
  if (st.extra === 'poncho') rect(g, o, 6 + dy, 10, 5, st.shirt);

  // head
  if (!space) {
    rect(g, o + 2, 1 + dy, 6, 2, hair); rect(g, o + 1, 2 + dy, 1, 3, hair); rect(g, o + 8, 2 + dy, 1, 3, hair);
    rect(g, o + 2, 3 + dy, 6, 3, '#f0c8a0');
    rect(g, o + 3, 4 + dy, 1, 1, '#2a1a10'); rect(g, o + 6, 4 + dy, 1, 1, '#2a1a10');
  }

  // torso
  rect(g, o + 2, 6 + dy, 6, 5, st.shirt);
  if (st.extra === 'parka') { rect(g, o + 2, 10 + dy, 6, 1, st.shirt2); rect(g, o + 4, 6 + dy, 2, 5, st.shirt2); }
  else if (st.extra === 'sash') rect(g, o + 2, 9 + dy, 6, 2, st.c2);
  else if (st.extra === 'scarf') rect(g, o + 2, 6 + dy, 6, 1, st.c2);
  else if (st.extra === 'flowers') { rect(g, o + 3, 7 + dy, 1, 1, st.shirt2); rect(g, o + 6, 8 + dy, 1, 1, st.shirt2); rect(g, o + 4, 9 + dy, 1, 1, st.shirt2); }
  else if (st.extra === 'robe') { rect(g, o + 4, 6 + dy, 2, 5, st.shirt2); }
  else if (space) { rect(g, o + 3, 7 + dy, 2, 2, PATCH[seed % PATCH.length]); rect(g, o + 6, 7 + dy, 1, 1, '#9aa0aa'); rect(g, o + 2, 10 + dy, 6, 1, '#9aa0aa'); }
  else rect(g, o + 2, 10 + dy, 6, 1, '#4a3320');

  // legs
  if (sit) rect(g, o + 1, 10 + dy, 8, 2, st.pants);
  else {
    const l = pose === 'walk0' ? 0 : 1, r = pose === 'walk1' ? 0 : 1;
    rect(g, o + 2, 11, 2, 4 - l, st.pants); rect(g, o + 6, 11, 2, 4 - r, st.pants);
    if (st.extra === 'robe') { rect(g, o + 2, 11, 6, 3, st.shirt); rect(g, o + 2, 13, 6, 1, st.shirt2); }
    rect(g, o + 2, 15 - l, 2, 1, st.boots); rect(g, o + 6, 15 - r, 2, 1, st.boots);
  }

  // arms and tool
  const arm = space ? st.shirt : st.shirt;
  if (pose === 'chop0') {
    rect(g, o + 8, 6, 1, 3, space ? '#c8ccd4' : '#f0c8a0'); rect(g, o + 9, 1, 1, 6, '#7a5230'); rect(g, o + 9, 0, 3, 3, '#aab0b8'); rect(g, o, 6, 2, 3, arm);
  } else if (pose === 'chop1') {
    rect(g, o + 8, 8, 1, 2, space ? '#c8ccd4' : '#f0c8a0'); rect(g, o + 9, 9, 4, 1, '#7a5230'); rect(g, o + 12, 7, 2, 4, '#aab0b8'); rect(g, o, 6, 2, 4, arm);
  } else {
    rect(g, o, 6, 2, 4, arm); rect(g, o + 8, 6, 2, 4, arm);
    if (space) { rect(g, o, 9, 2, 1, '#9aa0aa'); rect(g, o + 8, 9, 2, 1, '#9aa0aa'); }
  }

  // headwear
  const hx = o, hy = dy;
  switch (st.head) {
    case 'strawhat': rect(g, hx + 2, hy, 6, 2, st.c1); rect(g, hx, 1 + hy, 10, 1, st.c2); break;
    case 'cap': rect(g, hx + 2, hy, 6, 2, st.c1); rect(g, hx + 8, 1 + hy, 2, 1, st.c1); rect(g, hx + 7, hy - 1 < 0 ? 0 : hy, 1, 1, st.c2); break;
    case 'beanie': rect(g, hx + 2, hy, 6, 2, st.c1); rect(g, hx + 2, 2 + hy, 6, 1, st.c2); break;
    case 'bun': rect(g, hx + 3, hy, 4, 1, hair); rect(g, hx + 4, hy - 1 < 0 ? 0 : hy - 1, 2, 1, hair); rect(g, hx + 7, hy + 1, 2, 2, st.c1); break;
    case 'hood': rect(g, hx + 1, hy, 8, 2, st.c1); rect(g, hx + 1, 2 + hy, 1, 4, st.c1); rect(g, hx + 8, 2 + hy, 1, 4, st.c1); break;
    case 'furhood': rect(g, hx + 1, hy, 8, 2, st.c1); rect(g, hx + 1, 2 + hy, 1, 4, st.c2); rect(g, hx + 8, 2 + hy, 1, 4, st.c2); rect(g, hx + 2, 6 + hy, 6, 1, st.c1); break;
    case 'turban': rect(g, hx + 1, hy, 8, 3, st.c1); rect(g, hx + 1, 2 + hy, 8, 1, st.c2); break;
    case 'helmet': rect(g, hx + 2, hy, 6, 2, st.c1); rect(g, hx + 1, 2 + hy, 8, 1, '#c89a20'); rect(g, hx + 4, hy, 2, 1, st.c2); break;
    case 'spacehelmet': {
      rect(g, hx + 1, hy, 8, 1, '#e8f0f8'); rect(g, hx, 1 + hy, 1, 5, '#e8f0f8'); rect(g, hx + 9, 1 + hy, 1, 5, '#e8f0f8'); rect(g, hx + 1, 6 + hy, 8, 1, '#e8f0f8');
      rect(g, hx + 1, 1 + hy, 8, 5, '#26344f');            // visor
      rect(g, hx + 2, 2 + hy, 3, 1, st.c2); rect(g, hx + 2, 3 + hy, 1, 1, st.c2);  // gold reflection
      rect(g, hx + 6, 4 + hy, 2, 1, '#3a4a6f');
      break;
    }
    default: break;
  }
  cache.set(key, c);
  return c;
}
