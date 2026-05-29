import type { FitZone, GameMode } from '../types';
import { DIFFICULTY_ORDER, REGION_VALUES } from '../types';

type ProgressionResult = {
  isProgressionFired: boolean;
  isRegressionGuarded: boolean;
  nextDifficulty: string | null;
  nextMode: GameMode | null;
  nextRegion: string | null;
  alternativeStrategy: 'none' | 'expand-region' | 'change-mode';
};

const MODE_ORDER: GameMode[] = ['A', 'B', 'C', 'D'];

export function evaluateProgression(
  fitZone: FitZone,
  lastSessionAccuracy: number | null,
): ProgressionResult {
  const isRegressionGuarded = lastSessionAccuracy !== null && lastSessionAccuracy < 0.3;

  if (isRegressionGuarded) {
    return {
      isProgressionFired: false,
      isRegressionGuarded: true,
      nextDifficulty: null,
      nextMode: null,
      nextRegion: null,
      alternativeStrategy: 'none',
    };
  }

  const { isCappedAt, maxDifficulty } = fitZone;

  if (!isCappedAt) {
    return {
      isProgressionFired: false,
      isRegressionGuarded: false,
      nextDifficulty: null,
      nextMode: null,
      nextRegion: null,
      alternativeStrategy: 'none',
    };
  }

  // Progression fired: try to move to next difficulty
  const currentIdx = DIFFICULTY_ORDER.indexOf(maxDifficulty);
  if (currentIdx < DIFFICULTY_ORDER.length - 1) {
    return {
      isProgressionFired: true,
      isRegressionGuarded: false,
      nextDifficulty: DIFFICULTY_ORDER[currentIdx + 1],
      nextMode: null,
      nextRegion: null,
      alternativeStrategy: 'none',
    };
  }

  // At expert (達人) ceiling — try region expansion first
  const fitRegions = new Set(fitZone.cells.map((ca) => ca.cell.region));
  const unexploredRegion = REGION_VALUES.find((r) => !fitRegions.has(r));
  if (unexploredRegion) {
    return {
      isProgressionFired: true,
      isRegressionGuarded: false,
      nextDifficulty: null,
      nextMode: null,
      nextRegion: unexploredRegion,
      alternativeStrategy: 'expand-region',
    };
  }

  // All regions at expert — suggest mode change
  const fitModes = new Set(fitZone.cells.map((ca) => ca.cell.mode));
  const nextMode = MODE_ORDER.find((m) => !fitModes.has(m));
  if (nextMode) {
    return {
      isProgressionFired: true,
      isRegressionGuarded: false,
      nextDifficulty: null,
      nextMode,
      nextRegion: null,
      alternativeStrategy: 'change-mode',
    };
  }

  return {
    isProgressionFired: false,
    isRegressionGuarded: false,
    nextDifficulty: null,
    nextMode: null,
    nextRegion: null,
    alternativeStrategy: 'none',
  };
}
