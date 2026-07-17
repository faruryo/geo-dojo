import { describe, it, expect } from 'vitest';
import { ALL_PREFECTURES, PREFECTURE_KANA } from '@/lib/quiz/municipality-data';

describe('PREFECTURE_KANA', () => {
  it('ALL_PREFECTURES と完全に1:1対応する（欠落・余分なし）', () => {
    expect(Object.keys(PREFECTURE_KANA).sort()).toEqual([...ALL_PREFECTURES].sort());
  });

  it('全件がひらがなのみで構成される（カタカナ・漢字混入なし）', () => {
    for (const [pref, kana] of Object.entries(PREFECTURE_KANA)) {
      expect(kana, `${pref} の読みが不正: ${kana}`).toMatch(/^[ぁ-ん]+$/);
    }
  });
});
