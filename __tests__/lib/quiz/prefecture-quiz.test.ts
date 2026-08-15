import { describe, it, expect } from 'vitest';
import {
  buildPrefectureQuestions,
  formatClearTime,
  isNewBestTime,
  type PrefectureQuizSettings,
} from '@/lib/quiz/prefecture-quiz';

describe('formatClearTime', () => {
  it('1分未満のタイムを秒形式（SS.ss）で整形する', () => {
    expect(formatClearTime(24350)).toBe('24.35s');
    expect(formatClearTime(5120)).toBe('5.12s');
    expect(formatClearTime(0)).toBe('0.00s');
  });

  it('1分以上のタイムを分秒形式（M:SS.ss）で整形する', () => {
    expect(formatClearTime(65120)).toBe('1:05.12');
    expect(formatClearTime(125800)).toBe('2:05.80');
  });
});

describe('isNewBestTime', () => {
  it('既存のベストタイムがない場合は true を返す', () => {
    expect(isNewBestTime(30000, null)).toBe(true);
    expect(isNewBestTime(30000, undefined)).toBe(true);
  });

  it('既存ベストより速い場合は true を返す', () => {
    expect(isNewBestTime(25000, 30000)).toBe(true);
  });

  it('既存ベストと同じか遅い場合は false を返す', () => {
    expect(isNewBestTime(30000, 30000)).toBe(false);
    expect(isNewBestTime(35000, 30000)).toBe(false);
  });
});

describe('buildPrefectureQuestions', () => {
  it('指定された地域から指定問題数を抽出する', () => {
    const settings: PrefectureQuizSettings = {
      regions: ['東北'],
      count: 10,
      type: 'normal',
      weaknessFirst: false,
    };

    const questions = buildPrefectureQuestions(settings);
    // 東北は6県なので上限6件
    expect(questions).toHaveLength(6);
    expect(questions).toContain('青森県');
    expect(questions).toContain('秋田県');
  });

  it('全国指定で出題数10問の場合、10件抽出される', () => {
    const settings: PrefectureQuizSettings = {
      regions: ['全国'],
      count: 10,
      type: 'normal',
      weaknessFirst: false,
    };

    const questions = buildPrefectureQuestions(settings);
    expect(questions).toHaveLength(10);
    // 重複がないこと
    expect(new Set(questions).size).toBe(10);
  });

  it('出題数 all の場合、対象地域の全件が出題される', () => {
    const settings: PrefectureQuizSettings = {
      regions: ['全国'],
      count: 'all',
      type: 'timeAttack',
      weaknessFirst: false,
    };

    const questions = buildPrefectureQuestions(settings);
    expect(questions).toHaveLength(47);
  });

  it('苦手優先が有効な場合、誤答率が高い都道府県が含まれる', () => {
    const weaknessMap = new Map<string, number>([
      ['青森県', 0.8],
      ['岩手県', 0.6],
    ]);

    const settings: PrefectureQuizSettings = {
      regions: ['東北'],
      count: 10,
      type: 'normal',
      weaknessFirst: true,
    };

    const questions = buildPrefectureQuestions(settings, weaknessMap);
    expect(questions).toHaveLength(6);
    expect(questions).toContain('青森県');
    expect(questions).toContain('岩手県');
  });
});
