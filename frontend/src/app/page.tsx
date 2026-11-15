'use client';
import dynamic from 'next/dynamic';

// The scene builds canvases/WebGL textures, so it only runs in the browser.
const VillageApp = dynamic(() => import('../components/VillageApp'), { ssr: false });

export default function Page() {
  return <VillageApp />;
}
