import type { Difficulty, GameMode, Recommendation } from './types';

export type RecommendSource = Pick<Recommendation, 'mode' | 'count' | 'regions' | 'difficulties'>;

export type RecommendOverrides = {
  mode: GameMode;
  count: 10 | 20 | 30;
  targetRegions: string[];
  difficulties: Difficulty[];
};

export type StoredRecommendOverrides = {
  sessionKey: string;
  value: RecommendOverrides;
};

export function recommendSessionKey(source: RecommendSource): string {
  return [
    source.mode,
    String(source.count),
    source.regions.join(','),
    source.difficulties.join(','),
  ].join('|');
}

export function reconcileStoredOverrides(
  stored: StoredRecommendOverrides | null,
  sessionKey: string,
): StoredRecommendOverrides | null {
  if (stored === null || stored.sessionKey !== sessionKey) return null;
  return stored;
}

export function activeOverridesForSession(
  stored: StoredRecommendOverrides | null,
  sessionKey: string,
): RecommendOverrides | null {
  return reconcileStoredOverrides(stored, sessionKey)?.value ?? null;
}

export type RecommendStartParams = {
  mode: GameMode;
  count: 10 | 20 | 30;
  regions: readonly string[];
  difficulties: readonly Difficulty[];
};

export function resolveRecommendStartParams(
  source: RecommendSource,
  overrides: RecommendOverrides | null,
): RecommendStartParams {
  if (overrides === null) {
    return {
      mode: source.mode,
      count: source.count,
      regions: source.regions,
      difficulties: source.difficulties,
    };
  }

  return {
    mode: overrides.mode,
    count: overrides.count,
    regions: overrides.targetRegions,
    difficulties: overrides.difficulties,
  };
}
