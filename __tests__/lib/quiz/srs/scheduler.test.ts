import { describe, it, expect } from 'vitest';
import { isDue, shouldGraduate, alreadyAdvancedToday } from '@/lib/quiz/srs/scheduler';

describe('isDue', () => {
  it('due_date が now より前なら true', () => {
    const past = new Date(Date.now() - 1000);
    expect(isDue(past, new Date())).toBe(true);
  });

  it('due_date が now と同じなら true（境界）', () => {
    const now = new Date(1000);
    expect(isDue(now, now)).toBe(true);
  });

  it('due_date が now より後なら false', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isDue(future, new Date())).toBe(false);
  });
});

describe('shouldGraduate', () => {
  it('interval>=30 かつ repetition>=4 で true', () => {
    expect(shouldGraduate(30, 4)).toBe(true);
    expect(shouldGraduate(100, 10)).toBe(true);
  });

  it('interval<30 なら false', () => {
    expect(shouldGraduate(29, 4)).toBe(false);
  });

  it('repetition<4 なら false', () => {
    expect(shouldGraduate(30, 3)).toBe(false);
  });

  it('どちらも不足なら false', () => {
    expect(shouldGraduate(10, 2)).toBe(false);
  });
});

describe('alreadyAdvancedToday', () => {
  it('lastReviewedAt が null なら false', () => {
    expect(alreadyAdvancedToday(null, new Date())).toBe(false);
  });

  it('JST 同日なら true', () => {
    // JST 2026-06-01 12:00 (UTC 2026-06-01 03:00)
    const lastReviewed = new Date('2026-06-01T03:00:00Z');
    const now = new Date('2026-06-01T10:00:00Z'); // 同日 JST
    expect(alreadyAdvancedToday(lastReviewed, now)).toBe(true);
  });

  it('JST 日付が違えば false', () => {
    const yesterday = new Date('2026-05-31T03:00:00Z'); // JST 2026-05-31
    const now = new Date('2026-06-01T03:00:00Z');        // JST 2026-06-01
    expect(alreadyAdvancedToday(yesterday, now)).toBe(false);
  });

  it('JST 日付跨ぎ（UTC は同日でも JST で翌日）なら false', () => {
    // UTC 2026-06-01 15:00 = JST 2026-06-02 00:00
    const lastReviewed = new Date('2026-06-01T14:00:00Z'); // JST 2026-06-01 23:00
    const now = new Date('2026-06-01T15:00:00Z');           // JST 2026-06-02 00:00
    expect(alreadyAdvancedToday(lastReviewed, now)).toBe(false);
  });
});
