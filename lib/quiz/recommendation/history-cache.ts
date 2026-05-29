'use client';

import type { RecommendationHistoryCache } from './types';

const STORAGE_KEY = 'geodojo:recommendation:history';
const TTL_MS = 24 * 60 * 60 * 1000;

export function readRecommendationHistory(): RecommendationHistoryCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as RecommendationHistoryCache;
    const storedAt = new Date(cache.storedAt).getTime();
    if (Date.now() - storedAt > TTL_MS) return null;
    return cache;
  } catch {
    return null;
  }
}

export function writeRecommendationHistory(codes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cache: RecommendationHistoryCache = {
      lastCodes: codes,
      storedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be unavailable in private mode
  }
}
