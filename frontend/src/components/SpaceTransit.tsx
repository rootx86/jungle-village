'use client';
// The flight between Earth and the Moon: a pixel-art cinematic. Stars stream past, the origin planet shrinks
// behind the rocket and the destination grows ahead. Rendered at low resolution and scaled up with crisp pixels.
import { useEffect, useRef, useState } from 'react';
import { hash2 } from '@shared';
import { rocketSprite, flameSprite2 } from '../lib/art4';

const DURATION = 8.5;
const H = 270;

function planet(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: 'earth' | 'moon', t: number) {
  if (r < 1) return;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (kind === 'earth') {
    g.fillStyle = '#1d5fb8'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    const step = Math.max(2, Math.floor(r / 22));
    for (let y = -r; y < r; y += step) for (let x = -r; x < r; x += step) {
      const u = (x + t * 6) / 38, v = y / 38;
      const n = hash2(Math.floor(u * 1.7), Math.floor(v * 1.7), 301) * 0.5 + hash2(Math.floor(u * 3.4), Math.floor(v * 3.4), 302) * 0.5;
      if (n > 0.58) { g.fillStyle = n > 0.74 ? '#d8cc8a' : n > 0.66 ? '#3a9a48' : '#2f8a3e'; g.fillRect(cx + x, cy + y, step, step); }
      const c = hash2(Math.floor(u * 2.3 + 40), Math.floor(v * 2.3), 303);
      if (c > 0.74) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(cx + x, cy + y, step, step); }
    }
  } else {
    g.fillStyle = '#9a98a4'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, 1, 310) * 6.28, d = Math.sqrt(hash2(i, 2, 310)) * r * 0.9, cr = (0.05 + hash2(i, 3, 310) * 0.16) * r;
      g.fillStyle = 'rgba(70,68,80,0.55)'; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr, 0, 6.28); g.fill();
      g.strokeStyle = 'rgba(214,212,224,0.6)'; g.lineWidth = Math.max(1, r * 0.012); g.beginPath(); g.arc(cx + Math.cos(a) * d - cr * 0.1, cy + Math.sin(a) * d - cr * 0.1, cr, 3.6, 5.5); g.stroke();
    }
  }
  const sh = g.createRadialGradient(cx - r * 0.45, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,12,0.8)');
  g.fillStyle = sh; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore();
  if (kind === 'earth') { // thin atmosphere
    g.strokeStyle = 'rgba(120,190,255,0.55)'; g.lineWidth = Math.max(1, r * 0.04);
    g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.stroke();
  }
}

export default function SpaceTransit({ direction, onDone }: { direction: 'toMoon' | 'toEarth'; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState('');
  useEffect(() => {
    const cvs = ref.current!, g = cvs.getContext('2d')!;
    const W = Math.round(H * (window.innerWidth / window.innerHeight));
    cvs.width = W; cvs.height = H;
    const stars = Array.from({ length: 160 }, (_, i) => ({ x: hash2(i, 1, 320) * W, y: hash2(i, 2, 320) * H, z: 0.3 + hash2(i, 3, 320) * 1.4, c: hash2(i, 4, 320) }));
    const rocket = rocketSprite(), flames = [0, 1, 2].map((f) => flameSprite2(f));
    const up = direction === 'toMoon';
    const stages = up
      ? ['Leaving the atmosphere', 'Translunar coast', 'Lunar approach', 'Landing burn ignition']
      : ['Departing the Moon', 'Earth transit', 'Re-entry approach', 'Landing burn ignition'];
    let start = 0, raf = 0, done = false, last = '';
    const frame = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / 1000, p = Math.min(1, t / DURATION), ease = p * p * (3 - 2 * p);
      g.fillStyle = '#04050f'; g.fillRect(0, 0, W, H);
      const speed = 40 + 160 * Math.sin(Math.min(1, p * 1.2) * Math.PI * 0.5) * (1 - p * 0.5);
      for (const s of stars) {
        s.y += speed * s.z * 0.016 * (up ? 1 : -1);
        if (s.y > H) s.y -= H; if (s.y < 0) s.y += H;
        const len = Math.min(5, Math.floor(speed * s.z * 0.02));
        g.fillStyle = s.c > 0.8 ? '#bcd8ff' : s.c > 0.5 ? '#ffffff' : '#8a8fb8';
        g.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1 + len);
      }
      // origin behind, destination ahead
      const origin = up ? 'earth' : 'moon', dest = up ? 'moon' : 'earth';
      const oy = up ? H * 0.95 + ease * H * 0.5 : H * 0.05 - ease * H * 0.5, or = (up ? 150 : 100) * (1 - ease) + 6;
      const dy = up ? -10 + ease * 95 : H + 10 - ease * 95, dr = 4 + ease * (up ? 120 : 140);
      planet(g, W * (0.5 - 0.1 * (1 - ease)), dy, dr, dest as 'earth' | 'moon', t);
      planet(g, W / 2, oy, or, origin as 'earth' | 'moon', t);
      // rocket
      const sway = Math.sin(t * 3) * 1.2 * (1 - p * 0.6), rx = Math.round(W / 2 + sway), ry = Math.round(H * 0.5 - rocket.height / 2);
      g.save(); g.translate(rx, ry + rocket.height / 2);
      if (!up) g.scale(1, -1);
      const fl = flames[Math.floor(t * 14) % 3], fs = p > 0.9 ? 1.2 : 0.8;
      g.drawImage(fl, -fl.width / 2, rocket.height / 2 - 14, fl.width, fl.height * fs);
      g.drawImage(rocket, -rocket.width / 2, -rocket.height / 2);
      g.restore();
      // letterbox + fades
      g.fillStyle = '#000'; g.fillRect(0, 0, W, 16); g.fillRect(0, H - 16, W, 16);
      const white = Math.max(0, 1 - t / 0.6), out = Math.max(0, (t - (DURATION - 0.5)) / 0.5);
      if (white > 0) { g.fillStyle = `rgba(255,255,255,${white})`; g.fillRect(0, 0, W, H); }
      if (out > 0) { g.fillStyle = `rgba(255,255,255,${out})`; g.fillRect(0, 0, W, H); }
      const lab = stages[Math.min(3, Math.floor(p * 4))];
      if (lab !== last) { last = lab; setLabel(lab); }
      if (t >= DURATION && !done) { done = true; onDone(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [direction, onDone]);
  return (
    <div id="transit">
      <canvas ref={ref} />
      <div className="t-label">{label}</div>
    </div>
  );
}
