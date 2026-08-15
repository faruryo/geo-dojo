import { describe, it, expect } from 'vitest';
import { calculateStreak } from '@/lib/utils/streak';

describe('calculateStreak', () => {
  const TODAY = '2026-08-16';

  it('空配列の場合: current=0, longest=0, hasPlayedToday=false', () => {
    const result = calculateStreak([], TODAY);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      hasPlayedToday: false,
    });
  });

  it('今日のみプレイ: current=1, longest=1, hasPlayedToday=true', () => {
    const result = calculateStreak(['2026-08-16'], TODAY);
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      hasPlayedToday: true,
    });
  });

  it('昨日のみプレイ（今日未プレイ）: current=1, longest=1, hasPlayedToday=false', () => {
    const result = calculateStreak(['2026-08-15'], TODAY);
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      hasPlayedToday: false,
    });
  });

  it('一昨日が最終プレイ（昨日・今日未プレイ）: current=0, longest=1, hasPlayedToday=false', () => {
    const result = calculateStreak(['2026-08-14'], TODAY);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 1,
      hasPlayedToday: false,
    });
  });

  it('今日1日プレイ + 過去10日連続プレイ（中間に休みあり）: current=1, longest=10', () => {
    // 8/16（今日）, 休み, 8/1〜8/10（10日連続）
    const past10Days = [
      '2026-08-10',
      '2026-08-09',
      '2026-08-08',
      '2026-08-07',
      '2026-08-06',
      '2026-08-05',
      '2026-08-04',
      '2026-08-03',
      '2026-08-02',
      '2026-08-01',
    ];
    const dates = ['2026-08-16', ...past10Days];
    const result = calculateStreak(dates, TODAY);
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 10,
      hasPlayedToday: true,
    });
  });

  it('直近2日連続 + 過去5日連続（昨日・今日プレイ中）: current=2, longest=5', () => {
    const dates = [
      '2026-08-16',
      '2026-08-15',
      // 8/14 休み
      '2026-08-13',
      '2026-08-12',
      '2026-08-11',
      '2026-08-10',
      '2026-08-09',
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result).toEqual({
      currentStreak: 2,
      longestStreak: 5,
      hasPlayedToday: true,
    });
  });

  it('全期間連続プレイ（5日連続）: current=5, longest=5', () => {
    const dates = [
      '2026-08-16',
      '2026-08-15',
      '2026-08-14',
      '2026-08-13',
      '2026-08-12',
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      hasPlayedToday: true,
    });
  });

  it('常に longestStreak >= currentStreak が成立すること', () => {
    const testCases: string[][] = [
      [],
      ['2026-08-16'],
      ['2026-08-15'],
      ['2026-08-14'],
      ['2026-08-16', '2026-08-15', '2026-08-14'],
      ['2026-08-16', '2026-08-10'],
      ['2026-08-10', '2026-08-09', '2026-08-08'],
    ];
    for (const tc of testCases) {
      const res = calculateStreak(tc, TODAY);
      expect(res.longestStreak).toBeGreaterThanOrEqual(res.currentStreak);
    }
  });
});
