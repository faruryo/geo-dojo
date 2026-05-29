import type { LearnerState, Recommendation, GameMode, Difficulty } from './types';
import { cellKey, REGION_VALUES } from './types';
import { evaluateProgression } from './axes/progression';
import { selectExplorationPool } from './axes/exploration';
import { selectCoverageCodes } from './axes/coverage';
import { selectRationale } from './rationale';
import { weightedSample, shuffle } from '@/lib/quiz/municipality-data';
import type { Municipality } from '@/lib/quiz/municipality-data';

type MasterEntry = { code: string; region: string; difficulty: string; name: string; prefecture: string };

function modeFrequency(counts: (10 | 20 | 30)[]): 10 | 20 | 30 {
  if (counts.length === 0) return 10;
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  let best = 10 as 10 | 20 | 30;
  let bestCount = 0;
  for (const [k, v] of freq) {
    if (v > bestCount) { bestCount = v; best = k as 10 | 20 | 30; }
  }
  return best;
}

function weightedSampleCodes(
  codes: string[],
  weaknessMap: Map<string, number>,
  excludeCodes: string[],
  count: number,
): string[] {
  const excludeSet = new Set(excludeCodes);
  const municipalities: Municipality[] = codes.map((code) => ({
    code,
    name: code,
    prefecture: '',
    region: '',
  }));
  // Apply exclude penalty: lower weight for recently played codes
  const penaltyMap = new Map<string, number>();
  for (const code of excludeSet) penaltyMap.set(code, -0.7);
  const adjustedWeakness = new Map<string, number>();
  for (const code of codes) {
    const base = weaknessMap.get(code) ?? 0;
    const penalty = penaltyMap.get(code) ?? 0;
    // Floor at a small positive weight — weightedSample requires non-negative weights.
    adjustedWeakness.set(code, Math.max(0.01, base + penalty));
  }
  const sample = weightedSample(municipalities, adjustedWeakness, count);
  return sample.map((m) => m.code);
}

export function generateRecommendation(
  state: LearnerState,
  excludeCodes: string[],
  allMaster: MasterEntry[],
): Recommendation {
  const isColdStart = state.totalAnswers < 10;
  const count = modeFrequency(state.recentQuestionCounts);
  const excludeSet = new Set(excludeCodes);

  // Cold start fallback
  if (isColdStart) {
    const easyPool = allMaster.filter((m) => m.difficulty === 'easy');
    const shuffled = shuffle(easyPool).map((m) => m.code);
    const codes = shuffled.filter((c) => !excludeSet.has(c)).slice(0, 10);
    const { text } = selectRationale(
      { mode: 'B', difficulties: ['easy'], regions: [...REGION_VALUES], count: 10 },
      { isColdStart: true, isRegressionGuarded: false, isProgressionFired: false, isDifficultyCapped: false },
    );
    return {
      mode: 'B',
      difficulties: ['easy'],
      regions: [...REGION_VALUES],
      count: 10,
      codes: codes.length > 0 ? codes : shuffled.slice(0, 10),
      rationaleCategory: 'cold-start',
      rationaleText: text,
      poolBreakdown: { fitZoneWeakness: codes.length, coverageNew: 0, exploration: 0, randomFallback: 0 },
      isProgressionFired: false,
      isRegressionGuarded: false,
    };
  }

  // Regression guard
  const progression = evaluateProgression(state.fitZone, state.lastSessionAccuracy);

  // Determine target mode and difficulties
  let targetMode: GameMode = state.fitZone.cells[0]?.cell.mode ?? 'B';
  let targetDifficulties: Difficulty[] = [state.fitZone.maxDifficulty];

  if (progression.isProgressionFired) {
    if (progression.nextMode) targetMode = progression.nextMode;
    if (progression.nextDifficulty) {
      targetDifficulties = [state.fitZone.maxDifficulty, progression.nextDifficulty as Difficulty];
    }
  }

  // Target regions from Fit Zone
  let targetRegions: Exclude<import('./types').Region, '全国'>[] =
    [...new Set(state.fitZone.cells.map((ca) => ca.cell.region))];
  if (targetRegions.length === 0) targetRegions = [...REGION_VALUES];

  if (progression.nextRegion) {
    targetRegions = [...new Set([...targetRegions, progression.nextRegion as typeof REGION_VALUES[number]])];
  }

  // Build pools
  const fitZoneCellKeys = new Set(state.fitZone.cells.map((ca) => cellKey(ca.cell)));

  // 1. Fit Zone weakness pool (50%)
  const fitZoneCodes = allMaster
    .filter((m) => {
      return fitZoneCellKeys.has(`${m.difficulty}_${m.region}_${targetMode}`) &&
        targetDifficulties.includes(m.difficulty as Difficulty);
    })
    .map((m) => m.code);

  const fitZoneCount = Math.round(count * 0.5);
  const fitZoneSampled = weightedSampleCodes(fitZoneCodes, state.weaknessByMunicipality, excludeCodes, fitZoneCount);

  // 2. Coverage pool (20%)
  const coverageCount = Math.round(count * 0.2);
  const playedCodes = new Set<string>(state.weaknessByMunicipality.keys());
  const recentPlayedCodes = state.recentlyPlayedCodes;

  const coverageCodes = selectCoverageCodes(
    state.fitZone,
    allMaster,
    playedCodes,
    recentPlayedCodes,
    coverageCount,
  );
  const coverageSampled = coverageCodes.filter((c) => !excludeSet.has(c)).slice(0, coverageCount);

  // 3. Exploration pool (30%)
  const explorationCount = Math.round(count * 0.3);
  const explorationPool = selectExplorationPool(allMaster, state.cellAccuracies, state.cellCoverages, state.fitZone);
  const explorationSampled = explorationPool.filter((c) => !excludeSet.has(c)).slice(0, explorationCount);

  // Combine and deduplicate
  const selectedSet = new Set<string>();
  const codes: string[] = [];
  for (const c of [...fitZoneSampled, ...coverageSampled, ...explorationSampled]) {
    if (!selectedSet.has(c)) { selectedSet.add(c); codes.push(c); }
  }

  // Random fallback if not enough
  let randomFallback = 0;
  if (codes.length < count) {
    const remaining = allMaster
      .map((m) => m.code)
      .filter((c) => !selectedSet.has(c))
      .filter((c) => !excludeSet.has(c));
    const shuffled = shuffle(remaining);
    const needed = count - codes.length;
    for (const c of shuffled.slice(0, needed)) {
      codes.push(c);
      selectedSet.add(c);
      randomFallback++;
    }
  }

  const rationale = selectRationale(
    { mode: targetMode, difficulties: targetDifficulties, regions: targetRegions, count },
    {
      isColdStart: false,
      isRegressionGuarded: progression.isRegressionGuarded,
      isProgressionFired: progression.isProgressionFired,
      isDifficultyCapped: state.fitZone.isCappedAt !== null,
      nextDifficulty: progression.nextDifficulty,
      nextMode: progression.nextMode,
      nextRegion: progression.nextRegion,
      alternativeStrategy: progression.alternativeStrategy,
      weaknessCount: [...state.weaknessByMunicipality.values()].filter((r) => r > 0.5).length,
      newExplorationCount: explorationSampled.length,
    },
  );

  return {
    mode: targetMode,
    difficulties: targetDifficulties,
    regions: targetRegions,
    count,
    codes: codes.slice(0, count),
    rationaleCategory: rationale.category,
    rationaleText: rationale.text,
    poolBreakdown: {
      fitZoneWeakness: fitZoneSampled.length,
      coverageNew: coverageSampled.length,
      exploration: explorationSampled.length,
      randomFallback,
    },
    isProgressionFired: progression.isProgressionFired,
    isRegressionGuarded: progression.isRegressionGuarded,
  };
}
