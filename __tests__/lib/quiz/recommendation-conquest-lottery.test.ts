import { describe, expect, it } from 'vitest';
import { generateConquestRecommendation, cellSessionKey, modeFrequency } from '@/lib/quiz/recommendation/conquest-lottery';
import type { LearnerState } from '@/lib/quiz/recommendation/types';
import type { Difficulty } from '@/lib/quiz/municipality-data';

type MasterEntry = { code: string; region: string; difficulty: string; name: string; prefecture: string };

function master(partial: Partial<MasterEntry> & { code: string }): MasterEntry {
  return {
    region: '関東',
    difficulty: 'easy',
    name: `市${partial.code}`,
    prefecture: '東京都',
    ...partial,
  };
}

function emptyState(clearedA: string[] = [], clearedD: string[] = []): LearnerState {
  return {
    userId: 'u',
    totalSessions: 1,
    totalAnswers: 20,
    cellAccuracies: new Map(),
    cellCoverages: new Map(),
    fitZone: { cells: [], maxDifficulty: 'easy', isCappedAt: null },
    weaknessByMunicipality: new Map(),
    lastSessionAccuracy: 0.7,
    recentQuestionCounts: [10],
    recentlyPlayedCodes: new Set(),
    playedModes: new Set(),
    crowdAccuracyByDifficulty: { easy: 0.6, medium: 0.55, hard: 0.5, expert: 0.45 },
    clearedCodesByMode: new Map([
      ['A', new Set(clearedA)],
      ['B', new Set()],
      ['C', new Set()],
      ['D', new Set(clearedD)],
    ]),
  };
}

const allMaster: MasterEntry[] = [];
for (const region of ['東北', '関東', '北海道'] as const) {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as Difficulty[]) {
    for (let i = 0; i < 4; i++) {
      allMaster.push(
        master({
          code: `${region}-${difficulty}-${i}`,
          region,
          difficulty,
          name: `${region}${difficulty}${i}`,
          prefecture: region === '北海道' ? '北海道' : '東京都',
        }),
      );
    }
  }
}

const tohokuCodes = allMaster.filter((m) => m.region === '東北').map((m) => m.code);

describe('generateConquestRecommendation', () => {
  it('picks A when the first random draw is below 0.5', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
    });
    expect(rec.mode).toBe('A');
    expect(rec.regions).not.toContain('北海道');
  });

  it('picks D when the first random draw is 0.5 or above', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.6,
    });
    expect(rec.mode).toBe('D');
  });

  it('does not include Hokkaido as an A region', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
    });
    expect(rec.mode).toBe('A');
    expect(rec.regions[0]).not.toBe('北海道');
  });

  it('selects the easiest difficulty still below 90% in the chosen region', () => {
    const kantoEasy = allMaster.filter((m) => m.region === '関東' && m.difficulty === 'easy');
    const rec = generateConquestRecommendation(
      emptyState([...tohokuCodes, ...kantoEasy.map((m) => m.code)]),
      [],
      allMaster,
      { random: () => 0.1 },
    );
    expect(rec.mode).toBe('A');
    if (rec.regions[0] === '関東') {
      expect(rec.difficulties[0]).toBe('medium');
    }
  });

  it('swaps A to B/C when last A is a struggle and B/C cells are empty', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
      client: {
        lastA: {
          sessionId: 's1',
          mode: 'A',
          accuracy: 0.2,
          questionCount: 10,
          region: '関東',
          difficulty: 'easy',
        },
        lastByCell: {},
        swapConsumedForASessionId: null,
      },
    });
    expect(['B', 'C']).toContain(rec.mode);
  });

  it('does not swap D on a low last-A score', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.6,
      client: {
        lastA: {
          sessionId: 's1',
          mode: 'A',
          accuracy: 0.1,
          questionCount: 10,
          region: '関東',
          difficulty: 'easy',
        },
        lastByCell: {},
        swapConsumedForASessionId: null,
      },
    });
    expect(rec.mode).toBe('D');
  });

  it('keeps A when the same session already consumed a B/C swap', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
      client: {
        lastA: {
          sessionId: 's1',
          mode: 'A',
          accuracy: 0.1,
          questionCount: 10,
          region: '関東',
          difficulty: 'easy',
        },
        lastByCell: {},
        swapConsumedForASessionId: 's1',
      },
    });
    expect(rec.mode).toBe('A');
  });

  it('keeps A when same-cell B and C are both above 30%', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
      client: {
        lastA: {
          sessionId: 's1',
          mode: 'A',
          accuracy: 0.1,
          questionCount: 10,
          region: '関東',
          difficulty: 'easy',
        },
        lastByCell: {
          [cellSessionKey('B', '関東', 'easy')]: {
            sessionId: 'b1',
            mode: 'B',
            accuracy: 0.8,
            questionCount: 10,
            region: '関東',
            difficulty: 'easy',
          },
          [cellSessionKey('C', '関東', 'easy')]: {
            sessionId: 'c1',
            mode: 'C',
            accuracy: 0.9,
            questionCount: 10,
            region: '関東',
            difficulty: 'easy',
          },
        },
        swapConsumedForASessionId: null,
      },
    });
    expect(rec.mode).toBe('A');
  });

  it('does not swap when there is no last A session', () => {
    const rec = generateConquestRecommendation(emptyState(tohokuCodes), [], allMaster, {
      random: () => 0.1,
      client: { lastA: null, lastByCell: {}, swapConsumedForASessionId: null },
    });
    expect(rec.mode).toBe('A');
  });

  it('uses the most frequent recent question count, not the last session', () => {
    const state = emptyState(tohokuCodes);
    state.recentQuestionCounts = [20, 20, 10];
    const rec = generateConquestRecommendation(state, [], allMaster, { random: () => 0.1 });
    expect(rec.count).toBe(20);
  });
});

describe('modeFrequency', () => {
  it('returns 20 for [20, 20, 10]', () => {
    expect(modeFrequency([20, 20, 10])).toBe(20);
  });
});
