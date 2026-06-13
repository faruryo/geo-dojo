import { describe, it, expect } from 'vitest';
import { generateRecommendation } from '@/lib/quiz/recommendation/engine';
import type {
  LearnerState,
  CellAccuracy,
  Cell,
  GameMode,
  Difficulty,
} from '@/lib/quiz/recommendation/types';
import { cellKey } from '@/lib/quiz/recommendation/types';

type MasterEntry = { code: string; region: string; difficulty: string; name: string; prefecture: string };

// 関東に easy / medium の市区町村マスタを用意（プール充填用）。
const allMaster: MasterEntry[] = [];
for (const difficulty of ['easy', 'medium'] as Difficulty[]) {
  for (let i = 0; i < 30; i++) {
    allMaster.push({
      code: `${difficulty}-${i}`,
      region: '関東',
      difficulty,
      name: `市${difficulty}${i}`,
      prefecture: '東京都',
    });
  }
}

function selfCell(mode: GameMode, difficulty: Difficulty): CellAccuracy {
  const cell: Cell = { mode, difficulty, region: '関東' };
  return { cell, movingAverage: 0.7, sessionCount: 3, windowSessions: [], source: 'self' };
}

function buildState(opts: {
  playedModes: GameMode[];
  // 追加で持たせる D の自前セル（復習だけのモードでは無い想定）
  modeDSelfDifficulty?: Difficulty;
}): LearnerState {
  // Fit Zone はモード A/B/C を medium 関東で確立（D は含めない＝未探索モード）
  const fitCells = (['A', 'B', 'C'] as GameMode[]).map((m) => selfCell(m, 'medium'));
  const cellAccuracies = new Map<string, CellAccuracy>();
  for (const ca of fitCells) cellAccuracies.set(cellKey(ca.cell), ca);
  if (opts.modeDSelfDifficulty) {
    const dCell = selfCell('D', opts.modeDSelfDifficulty);
    cellAccuracies.set(cellKey(dCell.cell), dCell);
  }

  return {
    userId: 'u1',
    totalSessions: 10,
    totalAnswers: 100,
    cellAccuracies,
    cellCoverages: new Map(),
    fitZone: { cells: fitCells, maxDifficulty: 'medium', isCappedAt: null },
    weaknessByMunicipality: new Map(),
    lastSessionAccuracy: 0.7,
    recentQuestionCounts: [20],
    recentlyPlayedCodes: new Set(),
    playedModes: new Set(opts.playedModes),
    crowdAccuracyByDifficulty: { easy: 0.6, medium: 0.55, hard: 0.5, expert: 0.45 },
  };
}

describe('generateRecommendation: novel mode injection', () => {
  it('一度も触っていないモードDは「未挑戦」と説明される', () => {
    const state = buildState({ playedModes: ['A', 'B', 'C'] });
    const rec = generateRecommendation(state, [], allMaster);
    expect(rec.mode).toBe('D');
    expect(rec.rationaleText).toContain('モードDは未挑戦');
  });

  it('復習などでDを答えたことがあれば「未挑戦」とは言わない（playedModes は生回答ベース）', () => {
    // inferSessions では拾えない混在復習回答でも、playedModes に D が入っていれば
    // 完全未挑戦扱いしない。
    const state = buildState({ playedModes: ['A', 'B', 'C', 'D'] });
    const rec = generateRecommendation(state, [], allMaster);
    expect(rec.mode).toBe('D');
    expect(rec.rationaleText).not.toContain('未挑戦');
    expect(rec.rationaleText).toContain('モードDをもっと練習');
  });

  it('novel モードの難易度は他モードの Fit Zone を流用せず easy から始める', () => {
    const state = buildState({ playedModes: ['A', 'B', 'C'] });
    const rec = generateRecommendation(state, [], allMaster);
    // 他モードは medium だが、未経験の D は easy(☆) で出題する。
    expect(rec.difficulties).toEqual(['easy']);
  });

  it('novel モードに自前の実績があればそのモード自身の難易度を使う', () => {
    const state = buildState({ playedModes: ['A', 'B', 'C', 'D'], modeDSelfDifficulty: 'medium' });
    const rec = generateRecommendation(state, [], allMaster);
    expect(rec.mode).toBe('D');
    expect(rec.difficulties).toEqual(['medium']);
  });
});
