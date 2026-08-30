import { describe, it, expect } from 'vitest';
import { generateRecommendation } from '@/lib/quiz/recommendation/engine';
import type { LearnerState } from '@/lib/quiz/recommendation/types';

const allMaster = [
  { code: '1', region: '関東', difficulty: 'easy', name: '市1', prefecture: '東京都' },
  { code: '2', region: '関東', difficulty: 'easy', name: '市2', prefecture: '東京都' },
  { code: '3', region: '関東', difficulty: 'easy', name: '市3', prefecture: '東京都' },
  { code: '4', region: '関東', difficulty: 'easy', name: '市4', prefecture: '東京都' },
];

const state: LearnerState = {
  userId: 'u1',
  totalSessions: 10,
  totalAnswers: 100,
  cellAccuracies: new Map(),
  cellCoverages: new Map(),
  fitZone: { cells: [], maxDifficulty: 'easy', isCappedAt: null },
  weaknessByMunicipality: new Map(),
  lastSessionAccuracy: 0.7,
  recentQuestionCounts: [10],
  recentlyPlayedCodes: new Set(),
  playedModes: new Set(['A', 'B', 'C']),
  crowdAccuracyByDifficulty: { easy: 0.6, medium: 0.55, hard: 0.5, expert: 0.45 },
};

describe('generateRecommendation (conquest lottery)', () => {
  it('returns A or D rather than Fit Zone novel-mode injection', () => {
    const recA = generateRecommendation(state, [], allMaster, { random: () => 0.1 });
    const recD = generateRecommendation(state, [], allMaster, { random: () => 0.6 });
    expect(recA.mode).toBe('A');
    expect(recD.mode).toBe('D');
  });
});
