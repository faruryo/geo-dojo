import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const nextConfig: NextConfig = {};

// withSerwist adds webpack config that breaks Turbopack (`next dev --turbopack`).
// Skip it entirely in development — SWs are not needed there anyway.
export default process.env.NODE_ENV === 'development'
  ? nextConfig
  : withSerwist({
      swSrc: 'app/sw.ts',
      swDest: 'public/sw.js',
      // Large map files exceed workbox's 2MB precache limit and cause webpack to hang.
      // They are handled by CacheFirst runtime caching in sw.ts instead.
      exclude: [/japan-municipalities\.topojson$/, /municipalities\.json$/],
    })(nextConfig);
