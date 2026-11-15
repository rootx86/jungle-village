'use client';
// Dev page: every house style and villager outfit side by side (http://localhost:3000/gallery).
import { useEffect, useRef } from 'react';
import { BIOMES, type Tier } from '@shared';
import { houseSprite } from '../../lib/houses';
import { villagerSprite, type Outfit } from '../../lib/outfits';
import { habitatSprite } from '../../lib/art4';

const TIERS: Tier[] = ['hut', 'house', 'cottage', 'manor'];
const S = 3;

export default function Gallery() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto';
    const c = ref.current!, g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.font = '12px sans-serif';
    BIOMES.forEach((b, row) => {
      const y = 10 + row * 190;
      g.fillText(b, 4, y + 8);
      TIERS.forEach((t, i) => { const s = houseSprite(t, b); g.drawImage(s, 80 + i * 170, y + 150 - s.height * S + 20, s.width * S, s.height * S); });
      (['stand', 'walk0', 'chop0', 'sit'] as const).forEach((p, i) => { const s = villagerSprite(row + i, p, b as Outfit); g.drawImage(s, 780 + i * 70, y + 40, s.width * 3, s.height * 3); });
    });
    const y = 10 + BIOMES.length * 190;
    g.fillText('space', 4, y + 8);
    (['stand', 'walk0', 'chop0', 'sit'] as const).forEach((p, i) => { const s = villagerSprite(i + 1, p, 'space'); g.drawImage(s, 780 + i * 70, y + 40, s.width * 3, s.height * 3); });
    TIERS.forEach((t, i) => { const s = habitatSprite(t); g.drawImage(s, 80 + i * 170, y + 120 - s.height * S + 20, s.width * S, s.height * S); });
  }, []);
  return <canvas ref={ref} width={1100} height={(BIOMES.length + 1) * 190 + 20} style={{ display: 'block', imageRendering: 'pixelated' }} />;
}
