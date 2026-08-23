import { describe, it, expect } from 'vitest';
import { inferSessions, computeCellAccuracies } from '@/lib/quiz/recommendation/cell-stats';

describe('recommendation state robustness', () => {
  it('inferSessions handles string answeredAt timestamps correctly', () => {
    const baseTime = new Date('2026-08-19T00:00:00.000Z').getTime();
    const rows = Array.from({ length: 10 }, (_, i) => ({
      municipalityCode: `code-${i}`,
      municipalityName: `市${i}`,
      prefecture: '東京都',
      mode: 'B',
      isCorrect: i % 2 === 0,
      answeredAt: new Date(baseTime + i * 1000).toISOString() as unknown as Date,
    }));

    const sessions = inferSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].count).toBe(10);
    expect(sessions[0].accuracy).toBe(0.5);
    expect(sessions[0].startAt).toBeInstanceOf(Date);
    expect(sessions[0].endAt).toBeInstanceOf(Date);
  });

  it('computeCellAccuracies handles sessions with string or Date timestamps', () => {
    const masterMap = new Map([
      ['code-0', { code: 'code-0', region: '関東', difficulty: 'easy' }],
    ]);
    const baseTime = new Date('2026-08-19T00:00:00.000Z');
    const sessions = [
      {
        startAt: baseTime,
        endAt: new Date(baseTime.getTime() + 10000),
        mode: 'B' as const,
        rows: [
          {
            municipalityCode: 'code-0',
            municipalityName: '市0',
            prefecture: '東京都',
            isCorrect: true,
            answeredAt: baseTime,
          },
        ],
        accuracy: 1,
        count: 10 as const,
      },
    ];

    const result = computeCellAccuracies(sessions, masterMap, {
      easy: 0.6,
      medium: 0.55,
      hard: 0.5,
      expert: 0.45,
    });

    expect(result.size).toBeGreaterThan(0);
  });
});
