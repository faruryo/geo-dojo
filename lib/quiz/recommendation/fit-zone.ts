import type { CellAccuracy, FitZone } from './types';
import { DIFFICULTY_ORDER } from './types';

export function extractFitZone(cellAccuracies: Map<string, CellAccuracy>): FitZone {
  const all = [...cellAccuracies.values()];

  let cells = all.filter((ca) => ca.movingAverage >= 0.6 && ca.movingAverage <= 0.8);

  if (cells.length === 0) {
    // Guarantee at least 1 cell: pick the one closest to 0.7
    const sorted = [...all].sort((a, b) =>
      Math.abs(a.movingAverage - 0.7) - Math.abs(b.movingAverage - 0.7),
    );
    if (sorted.length > 0) cells = [sorted[0]];
  }

  const difficultyIndices = cells.map((ca) => DIFFICULTY_ORDER.indexOf(ca.cell.difficulty));
  const maxIdx = difficultyIndices.length > 0 ? Math.max(...difficultyIndices) : 0;
  const maxDifficulty = DIFFICULTY_ORDER[maxIdx] ?? 'easy';

  // isCappedAt: all Fit Zone cells at maxDifficulty and avg > 80%
  const atMax = cells.filter((ca) => ca.cell.difficulty === maxDifficulty);
  const allAtMax = atMax.length === cells.length && cells.length > 0;
  const avgAtMax = atMax.length > 0
    ? atMax.reduce((a, ca) => a + ca.movingAverage, 0) / atMax.length
    : 0;
  const isCappedAt = allAtMax && avgAtMax > 0.8 ? maxDifficulty : null;

  return { cells, maxDifficulty, isCappedAt };
}
