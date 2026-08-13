import { describe, it, expect } from 'vitest';
import { normalizeAnswerTimeMs, MAX_ANSWER_TIME_MS } from '@/lib/quiz/answer-time';

describe('normalizeAnswerTimeMs', () => {
  it('正常なミリ秒数を四捨五入して整数で返す', () => {
    expect(normalizeAnswerTimeMs(1234.56)).toBe(1235);
    expect(normalizeAnswerTimeMs(0)).toBe(0);
    expect(normalizeAnswerTimeMs(5000)).toBe(5000);
    expect(normalizeAnswerTimeMs(MAX_ANSWER_TIME_MS)).toBe(MAX_ANSWER_TIME_MS);
  });

  it('負の数は null になる', () => {
    expect(normalizeAnswerTimeMs(-100)).toBeNull();
  });

  it('PostgreSQL integer 上限 (2,147,483,647) を超える大きな数は DB エラー防止のため null になる', () => {
    expect(normalizeAnswerTimeMs(MAX_ANSWER_TIME_MS + 1)).toBeNull();
    expect(normalizeAnswerTimeMs(3_000_000_000)).toBeNull();
    expect(normalizeAnswerTimeMs(Infinity)).toBeNull();
  });

  it('undefined や null, NaN, string 等の不正な型は null になる', () => {
    expect(normalizeAnswerTimeMs(undefined)).toBeNull();
    expect(normalizeAnswerTimeMs(null)).toBeNull();
    expect(normalizeAnswerTimeMs(NaN)).toBeNull();
    expect(normalizeAnswerTimeMs('1000')).toBeNull();
  });
});
