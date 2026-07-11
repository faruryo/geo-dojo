import { describe, it, expect } from 'vitest';
import { evaluateProgression } from '@/lib/quiz/recommendation/axes/progression';
import type { FitZone, CellCoverage, Cell, CellAccuracy } from '@/lib/quiz/recommendation/types';
import { cellKey } from '@/lib/quiz/recommendation/types';

function buildCellAccuracy(
  mode: 'A' | 'B' | 'C' | 'D',
  difficulty: 'easy' | 'medium' | 'hard' | 'expert',
  region: string,
  movingAverage: number
): CellAccuracy {
  const cell: Cell = { mode, difficulty, region: region as any };
  return {
    cell,
    movingAverage,
    sessionCount: 5,
    windowSessions: [],
    source: 'self',
  };
}

describe('evaluateProgression with coverage rate constraint', () => {
  const cellAcc = buildCellAccuracy('B', 'easy', '関東', 1.0);
  const fitZone: FitZone = {
    cells: [cellAcc],
    maxDifficulty: 'easy',
    isCappedAt: 'easy',
  };

  it('should progress if cellCoverages is not provided (compatibility fallback)', () => {
    const res = evaluateProgression(fitZone, 1.0);
    expect(res.isProgressionFired).toBe(true);
    expect(res.nextDifficulty).toBe('medium');
  });

  it('should NOT progress if coverage is below 90%', () => {
    const coverages = new Map<string, CellCoverage>();
    const key = cellKey(cellAcc.cell);
    coverages.set(key, {
      cell: cellAcc.cell,
      totalMunicipalities: 10,
      conqueredCount: 5, // 50% coverage
      coverageRate: 0.5,
    });

    const res = evaluateProgression(fitZone, 1.0, coverages);
    expect(res.isProgressionFired).toBe(false);
    expect(res.nextDifficulty).toBeNull();
  });

  it('should progress if coverage is 90% or above', () => {
    const coverages = new Map<string, CellCoverage>();
    const key = cellKey(cellAcc.cell);
    coverages.set(key, {
      cell: cellAcc.cell,
      totalMunicipalities: 10,
      conqueredCount: 9, // 90% coverage
      coverageRate: 0.9,
    });

    const res = evaluateProgression(fitZone, 1.0, coverages);
    expect(res.isProgressionFired).toBe(true);
    expect(res.nextDifficulty).toBe('medium');
  });
});
