import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // R3F + imperative canvas/textures: avoid double-mount noise in dev
  poweredByHeader: false,
  // NEXT_OUTPUT=export -> static files for Cloudflare Pages; default -> standalone server (Docker)
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: { unoptimized: true },
  trailingSlash: false,
  outputFileTracingRoot: path.join(here, '..'), // the world generator is shared with ../backend/src/shared.ts
  experimental: { externalDir: true },
  ...(process.env.NEXT_OUTPUT === 'export' ? {} : { async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  } }),
};
export default nextConfig;
