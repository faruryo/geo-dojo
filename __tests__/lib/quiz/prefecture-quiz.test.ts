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
    expect(formatClearTime(59990)).toBe('59.99s');
  });

  it('1分以上のタイムを分秒形式（M:SS.ss）で整形する', () => {
    expect(formatClearTime(65120)).toBe('1:05.12');
    expect(formatClearTime(125800)).toBe('2:05.80');
  });

  it('分境界の繰り上がり（59999ms -> 1:00.00, 119999ms -> 2:00.00）を正しく処理する', () => {
    expect(formatClearTime(59999)).toBe('1:00.00');
    expect(formatClearTime(119999)).toBe('2:00.00');
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

  it('苦手優先が有効な場合、誤答率が高い都道府県が前方に優先配置される', () => {
    const weaknessMap = new Map<string, number>([
      ['青森県', 0.9],
      ['岩手県', 0.7],
      ['秋田県', 0.5],
    ]);

    const settings: PrefectureQuizSettings = {
      regions: ['東北'],
      count: 'all',
      type: 'normal',
      weaknessFirst: true,
    };

    const questions = buildPrefectureQuestions(settings, weaknessMap);
    expect(questions).toHaveLength(6);
    // スコア降順（青森 > 岩手 > 秋田 > 残り3県）で前方に並ぶこと
    expect(questions[0]).toBe('青森県');
    expect(questions[1]).toBe('岩手県');
    expect(questions[2]).toBe('秋田県');
  });

  it('苦手優先で出題数制限がある場合、高スコアの都道府県から優先的に選定・配置される', () => {
    const weaknessMap = new Map<string, number>([
      ['東京都', 1.0],
      ['大阪府', 0.9],
    ]);

    const settings: PrefectureQuizSettings = {
      regions: ['全国'],
      count: 10,
      type: 'normal',
      weaknessFirst: true,
    };

    const questions = buildPrefectureQuestions(settings, weaknessMap);
    expect(questions).toHaveLength(10);
    // 最初の2問は東京都・大阪府（同スコアグループ順）
    expect(questions[0]).toBe('東京都');
    expect(questions[1]).toBe('大阪府');
  });
});
