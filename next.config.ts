import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const nextConfig: NextConfig = {};

const withSerwistConfig = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

export default withSerwistConfig(nextConfig);
