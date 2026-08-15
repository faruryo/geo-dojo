import { describe, it, expect } from 'vitest';
import { getTomorrowReviewCount, type ScheduleItem } from '@/lib/quiz/srs/schedule-helper';

describe('getTomorrowReviewCount', () => {
  it('明日の日付に一致するスケジュールの件数を返す', () => {
    // 2026-08-15 JST 19:00 -> 明日は 2026-08-16
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule: ScheduleItem[] = [
      { date: '2026-08-16', count: 14 },
      { date: '2026-08-17', count: 8 },
      { date: '2026-08-18', count: 3 },
    ];

    expect(getTomorrowReviewCount(schedule, now)).toBe(14);
  });

  it('明日の復習予定が存在しない場合は 0 を返す', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule: ScheduleItem[] = [
      { date: '2026-08-17', count: 8 },
    ];

    expect(getTomorrowReviewCount(schedule, now)).toBe(0);
  });

  it('空配列または undefined / null が渡された場合は 0 を返す', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    expect(getTomorrowReviewCount([], now)).toBe(0);
    expect(getTomorrowReviewCount(undefined, now)).toBe(0);
    expect(getTomorrowReviewCount(null, now)).toBe(0);
  });

  it('年末・月跨ぎの境界値でも正しく明日の日付を判定する', () => {
    // 2026-12-31 JST 23:30 -> 明日は 2027-01-01
    const now = new Date('2026-12-31T14:30:00Z');
    const schedule: ScheduleItem[] = [
      { date: '2027-01-01', count: 20 },
      { date: '2027-01-02', count: 5 },
    ];

    expect(getTomorrowReviewCount(schedule, now)).toBe(20);
  });
});
