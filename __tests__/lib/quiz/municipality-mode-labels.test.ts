import { describe, expect, it } from 'vitest';
import { MUNICIPALITY_MODE_CATALOG } from '@/lib/quiz/municipality-mode-catalog';

describe('MUNICIPALITY_MODE_CATALOG', () => {
  it('labels A as 県当て地図, B/C as 練習, D as 場所当て地図', () => {
    const byKey = Object.fromEntries(MUNICIPALITY_MODE_CATALOG.map((m) => [m.key, m.longLabel]));
    expect(byKey.A).toContain('県当て');
    expect(byKey.A).toContain('地図');
    expect(byKey.B).toContain('県当て');
    expect(byKey.B).toContain('練習');
    expect(byKey.C).toContain('市当て');
    expect(byKey.C).toContain('練習');
    expect(byKey.D).toContain('場所当て');
  });
});
