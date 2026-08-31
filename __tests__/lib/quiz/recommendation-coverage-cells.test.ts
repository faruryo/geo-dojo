import { describe, expect, it } from 'vitest';
import { coverageRate } from '@/lib/quiz/recommendation/coverage-cells';

describe('coverageRate Mode A', () => {
  it('counts a name as cleared when a sibling code in another difficulty is cleared', () => {
    const master = [
      { code: 'e1', name: '横浜市', prefecture: '神奈川県', region: '関東', difficulty: 'easy' },
      { code: 'm1', name: '横浜市', prefecture: '神奈川県', region: '関東', difficulty: 'medium' },
      { code: 'e2', name: '川崎市', prefecture: '神奈川県', region: '関東', difficulty: 'easy' },
    ];
    const { total, cleared, rate } = coverageRate(
      'A',
      '関東',
      'easy',
      master,
      new Set(['m1']),
    );
    expect(total).toBe(2);
    expect(cleared).toBe(1);
    expect(rate).toBe(0.5);
  });

  it('does not count Tokyo special wards as Mode A coverage units', () => {
    const master = [
      { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
      { code: '13201', name: '八王子市', prefecture: '東京都', region: '関東', difficulty: 'easy' },
    ];
    const { total, cleared } = coverageRate('A', '関東', 'easy', master, new Set());
    expect(total).toBe(1);
    expect(cleared).toBe(0);
  });
});
