/* eslint-disable security/detect-object-injection */
import type { GameMode, Municipality } from '@/lib/quiz/municipality-data';

export type SamplingMode = 'mode_a' | 'mode_b' | 'mode_c' | 'mode_d';

export interface MunicipalityWeakness {
  municipalityCode: string;
  errorRate: number;
}

export interface IdentityCodeMap {
  modeA: Map<string, string[]>; // name -> codes[]
  modeBCD: Map<string, string[]>; // `${prefecture}:${normalizedName}` -> codes[]
}

const WARD_REGEX = /^([^市]+市)(.+区)$/;

/**
 * Normalizes designated city ward names (e.g., "静岡市葵区" -> "静岡市", "大阪市北区" -> "大阪市").
 * Tokyo 23 wards (131xx) are independent municipalities and kept as-is.
 */
export function normalizeMunicipalityName(name: string, code?: string): string {
  if (code && code.startsWith('131')) {
    return name;
  }
  const match = WARD_REGEX.exec(name);
  if (match) {
    return match[1];
  }
  return name;
}

/**
 * Builds an identity map from full master data to group all related codes by question unit.
 */
export function buildIdentityCodeMap(allMunicipalities: readonly Municipality[]): IdentityCodeMap {
  const modeA = new Map<string, string[]>();
  const modeBCD = new Map<string, string[]>();

  for (const item of allMunicipalities) {
    const normName = normalizeMunicipalityName(item.name, item.code);

    // Mode A: grouped by name
    const aList = modeA.get(normName) || [];
    aList.push(item.code);
    modeA.set(normName, aList);

    // Mode B/C/D: grouped by (prefecture, normalized name)
    const bcdKey = `${item.prefecture}:${normName}`;
    const bcdList = modeBCD.get(bcdKey) || [];
    bcdList.push(item.code);
    modeBCD.set(bcdKey, bcdList);
  }

  return { modeA, modeBCD };
}

export function getIdentityKey(item: Municipality, mode: SamplingMode | GameMode): string {
  const normName = normalizeMunicipalityName(item.name, item.code);
  const isModeA = mode === 'mode_a' || mode === 'A';
  if (isModeA) {
    return normName;
  }
  return `${item.prefecture}:${normName}`;
}

export function isIdentityCleared(
  identityKey: string,
  mode: SamplingMode | GameMode,
  clearedCodes: Set<string>,
  identityCodeMap?: IdentityCodeMap
): boolean {
  if (!identityCodeMap) {
    return false;
  }
  const isModeA = mode === 'mode_a' || mode === 'A';
  const codes = isModeA
    ? identityCodeMap.modeA.get(identityKey)
    : identityCodeMap.modeBCD.get(identityKey);

  if (!codes || codes.length === 0) {
    return false;
  }
  return codes.some((code) => clearedCodes.has(code));
}

export interface PoolStats {
  totalCount: number;
  clearedCount: number;
  percentage: number;
}

/**
 * Computes deterministic mastery progress stats for a given pool.
 */
export function computePoolStats(
  pool: readonly Municipality[],
  mode: SamplingMode | GameMode,
  clearedCodes: Set<string>,
  identityCodeMap?: IdentityCodeMap
): PoolStats {
  const uniqueIdentities = new Set<string>();

  for (const item of pool) {
    uniqueIdentities.add(getIdentityKey(item, mode));
  }

  const totalCount = uniqueIdentities.size;
  if (totalCount === 0) {
    return { totalCount: 0, clearedCount: 0, percentage: 0 };
  }

  let clearedCount = 0;
  for (const identityKey of uniqueIdentities) {
    if (isIdentityCleared(identityKey, mode, clearedCodes, identityCodeMap)) {
      clearedCount++;
    }
  }

  const rawPercentage = Math.round((clearedCount / totalCount) * 100);
  const percentage =
    clearedCount === totalCount ? 100 : Math.min(99, rawPercentage);
  return { totalCount, clearedCount, percentage };
}

export interface SamplePoolOptions {
  count: number;
  mode: SamplingMode | GameMode;
  unclearedFirst?: boolean;
  weaknessFirst?: boolean;
  clearedCodes?: Set<string>;
  weaknessMap?: Map<string, MunicipalityWeakness>;
  identityCodeMap?: IdentityCodeMap;
  random?: () => number;
}

/**
 * Deterministic Fisher-Yates shuffle using injected RNG.
 */
export function shuffleArray<T>(array: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...array];
  return copy
    .map((value) => ({ value, sortKey: random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ value }) => value);
}

function getAggregatedErrorRate(
  codes: readonly string[],
  weaknessMap: Map<string, MunicipalityWeakness>
): number {
  let maxError = 0;
  for (const code of codes) {
    const w = weaknessMap.get(code);
    if (w && w.errorRate > maxError) {
      maxError = w.errorRate;
    }
  }
  return maxError;
}

/**
 * Calculates aggregated weakness score for a municipality item/group.
 */
function getWeaknessScore(
  item: Municipality,
  mode: SamplingMode | GameMode,
  weaknessMap?: Map<string, MunicipalityWeakness>,
  identityCodeMap?: IdentityCodeMap
): number {
  if (!weaknessMap || weaknessMap.size === 0) return 0;

  if (identityCodeMap) {
    const identityKey = getIdentityKey(item, mode);
    const isModeA = mode === 'mode_a' || mode === 'A';
    const codes = isModeA
      ? identityCodeMap.modeA.get(identityKey)
      : identityCodeMap.modeBCD.get(identityKey);

    if (codes && codes.length > 0) {
      return getAggregatedErrorRate(codes, weaknessMap);
    }
  }

  const w = weaknessMap.get(item.code);
  return w ? w.errorRate : 0;
}

/**
 * Weighted sampling based on weakness score.
 */
function sampleWeighted(
  items: readonly Municipality[],
  count: number,
  mode: SamplingMode | GameMode,
  weaknessMap?: Map<string, MunicipalityWeakness>,
  identityCodeMap?: IdentityCodeMap,
  random: () => number = Math.random
): Municipality[] {
  if (items.length <= count) {
    return shuffleArray(items, random);
  }

  const scored = items.map((item) => ({
    item,
    weight: Math.max(0.01, getWeaknessScore(item, mode, weaknessMap, identityCodeMap) + 0.1),
  }));

  const selected: Municipality[] = [];
  const pool = [...scored];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = random() * totalWeight;

    let chosenIndex = 0;
    for (let i = 0; i < pool.length; i++) {
      const entry = pool.at(i);
      if (!entry) continue;
      r -= entry.weight;
      if (r <= 0) {
        chosenIndex = i;
        break;
      }
    }

    const chosen = pool.at(chosenIndex);
    if (chosen) {
      selected.push(chosen.item);
    }
    pool.splice(chosenIndex, 1);
  }

  return selected;
}

function sampleGroup(
  items: readonly Municipality[],
  count: number,
  options: SamplePoolOptions
): Municipality[] {
  if (items.length === 0 || count <= 0) return [];
  const { mode, weaknessFirst, weaknessMap, identityCodeMap, random = Math.random } = options;

  if (weaknessFirst && weaknessMap) {
    return sampleWeighted(items, count, mode, weaknessMap, identityCodeMap, random);
  }
  return shuffleArray(items, random).slice(0, count);
}

function deduplicatePoolByIdentity(
  pool: readonly Municipality[],
  mode: SamplingMode | GameMode,
): Municipality[] {
  const seen = new Set<string>();
  const deduped: Municipality[] = [];
  for (const item of pool) {
    const key = getIdentityKey(item, mode);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }
  return deduped;
}

/**
 * Pure function to sample municipality items according to priority options.
 */
export function sampleMunicipalityPool(
  pool: readonly Municipality[],
  options: SamplePoolOptions
): Municipality[] {
  const {
    count,
    mode,
    unclearedFirst = true,
    clearedCodes = new Set(),
    identityCodeMap,
    random = Math.random,
  } = options;

  const uniquePool = deduplicatePoolByIdentity(pool, mode);

  // If unclearedFirst is enabled and clearedCodes are provided
  if (unclearedFirst && clearedCodes.size > 0 && identityCodeMap) {
    const uncleared: Municipality[] = [];
    const cleared: Municipality[] = [];

    for (const item of uniquePool) {
      const identityKey = getIdentityKey(item, mode);
      if (isIdentityCleared(identityKey, mode, clearedCodes, identityCodeMap)) {
        cleared.push(item);
      } else {
        uncleared.push(item);
      }
    }

    const selectedUncleared = sampleGroup(uncleared, count, options);
    const remainingCount = count - selectedUncleared.length;
    if (remainingCount <= 0) {
      return selectedUncleared;
    }

    const selectedCleared = sampleGroup(cleared, remainingCount, options);
    return [...selectedUncleared, ...selectedCleared];
  }

  if (uniquePool.length <= count) {
    return shuffleArray(uniquePool, random);
  }

  return sampleGroup(uniquePool, count, options);
}

export interface BuildQuestionsOptions extends SamplePoolOptions {
  region?: string;
  difficulty?: string;
}

/**
 * Filter pool and build quiz questions.
 */
export function buildQuizQuestions(
  allMunicipalities: readonly Municipality[],
  options: BuildQuestionsOptions
): Municipality[] {
  let filtered = allMunicipalities;

  if (options.region && options.region !== 'all') {
    filtered = filtered.filter((item) => item.region === options.region);
  }

  if (options.difficulty && options.difficulty !== 'all') {
    filtered = filtered.filter((item) => item.difficulty === options.difficulty);
  }

  return sampleMunicipalityPool(filtered, options);
}
