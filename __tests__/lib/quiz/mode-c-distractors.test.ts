import { describe, it, expect } from 'vitest';
import { buildModeCDistractors, type Municipality } from '../../../lib/quiz/municipality-data';

describe('buildModeCDistractors', () => {
  const samplePool: Municipality[] = [
    // Easy (市・区)
    { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
    { code: '13102', name: '中央区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
    { code: '14100', name: '横浜市', prefecture: '神奈川県', region: '関東', difficulty: 'easy' },
    { code: '27100', name: '大阪市', prefecture: '大阪府', region: '近畿', difficulty: 'easy' },
    { code: '40100', name: '福岡市', prefecture: '福岡県', region: '九州', difficulty: 'easy' },
    { code: '01100', name: '札幌市', prefecture: '北海道', region: '北海道', difficulty: 'easy' },

    // Hard / Expert (村・町)
    { code: '13361', name: '利島村', prefecture: '東京都', region: '関東', difficulty: 'hard' },
    { code: '29449', name: '十津川村', prefecture: '奈良県', region: '近畿', difficulty: 'expert' },
    { code: '01564', name: '音威子府村', prefecture: '北海道', region: '北海道', difficulty: 'expert' },
    { code: '20583', name: '小川村', prefecture: '長野県', region: '中部', difficulty: 'hard' },
  ];

  it('selects distractors matching targetDifficulties (easy only)', () => {
    const target: Municipality = {
      code: '13101',
      name: '千代田区',
      prefecture: '東京都',
      region: '関東',
      difficulty: 'easy',
    };

    const distractors = buildModeCDistractors(target, samplePool, {
      targetDifficulties: ['easy'],
    });

    expect(distractors).toHaveLength(3);
    // 都道府県が「東京都」以外で、難易度が「easy」の自治体から選ばれるべき
    expect(distractors.includes('千代田区')).toBe(false);
    expect(distractors.includes('利島村')).toBe(false);
    expect(distractors.includes('十津川村')).toBe(false);
    expect(distractors.includes('音威子府村')).toBe(false);
    expect(distractors.includes('小川村')).toBe(false);

    const validEasyNames = ['横浜市', '大阪市', '福岡市', '札幌市'];
    for (const d of distractors) {
      expect(validEasyNames.includes(d)).toBe(true);
    }
  });

  it('excludes municipalities in the same target prefecture', () => {
    const target: Municipality = {
      code: '13101',
      name: '千代田区',
      prefecture: '東京都',
      region: '関東',
      difficulty: 'easy',
    };

    const distractors = buildModeCDistractors(target, samplePool);
    expect(distractors.includes('中央区')).toBe(false); // 東京都内の別区
    expect(distractors.includes('利島村')).toBe(false); // 東京都内の村
  });

  it('falls back to other difficulties if targetDifficulty candidates are fewer than 3', () => {
    const rarePool: Municipality[] = [
      { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
      { code: '14100', name: '横浜市', prefecture: '神奈川県', region: '関東', difficulty: 'easy' },
      { code: '29449', name: '十津川村', prefecture: '奈良県', region: '近畿', difficulty: 'expert' },
      { code: '01564', name: '音威子府村', prefecture: '北海道', region: '北海道', difficulty: 'expert' },
    ];

    const target: Municipality = {
      code: '13101',
      name: '千代田区',
      prefecture: '東京都',
      region: '関東',
      difficulty: 'easy',
    };

    // easy の候補は横浜市(1件)しかないので、全難易度からフォールバック補テンされるべき
    const distractors = buildModeCDistractors(target, rarePool, {
      targetDifficulties: ['easy'],
    });

    expect(distractors).toHaveLength(3);
    expect(distractors.includes('横浜市')).toBe(true);
  });
});
