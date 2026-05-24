import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, CacheFirst, ExpirationPlugin } from 'serwist';
import { defaultCache } from '@serwist/next/worker';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// @ts-expect-error sw context
declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // 地図データは CacheFirst で30日キャッシュ（憲法 II 条: 部分オフライン対応）
      matcher: ({ url }: { url: URL }) =>
        url.pathname.endsWith('japan.topojson') ||
        url.pathname.endsWith('japan-municipalities.topojson'),
      handler: new CacheFirst({
        cacheName: 'map-data',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
