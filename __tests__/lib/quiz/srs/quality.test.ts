import { describe, it, expect } from 'vitest';
import { determineReviewQuality, FAST_ANSWER_THRESHOLD_MS } from '@/lib/quiz/srs/quality';

describe('determineReviewQuality', () => {
  it('定数 FAST_ANSWER_THRESHOLD_MS が 10,000ms（10秒）である', () => {
    expect(FAST_ANSWER_THRESHOLD_MS).toBe(10_000);
  });

  describe('不正解（isCorrect = false）', () => {
    it('解答時間に関わらず常に quality = 2 を返す', () => {
      expect(determineReviewQuality(false, 3_000)).toBe(2);
      expect(determineReviewQuality(false, 10_000)).toBe(2);
      expect(determineReviewQuality(false, 15_000)).toBe(2);
      expect(determineReviewQuality(false)).toBe(2);
      expect(determineReviewQuality(false, null)).toBe(2);
    });
  });

  describe('正解（isCorrect = true）', () => {
    it('10秒以内（<= 10,000ms）の速答正解なら quality = 5 を返す', () => {
      expect(determineReviewQuality(true, 0)).toBe(5);
      expect(determineReviewQuality(true, 500)).toBe(5);
      expect(determineReviewQuality(true, 5_000)).toBe(5);
      expect(determineReviewQuality(true, 9_999)).toBe(5);
      expect(determineReviewQuality(true, 10_000)).toBe(5); // 境界値
    });

    it('10秒超（> 10,000ms）の通常正解なら quality = 4 を返す', () => {
      expect(determineReviewQuality(true, 10_001)).toBe(4); // 境界値
      expect(determineReviewQuality(true, 15_000)).toBe(4);
      expect(determineReviewQuality(true, 60_000)).toBe(4);
    });

    it('解答時間が未指定（null / 省略）または不正値なら quality = 4 を返す', () => {
      expect(determineReviewQuality(true)).toBe(4);
      expect(determineReviewQuality(true, null)).toBe(4);
      expect(determineReviewQuality(true, -100)).toBe(4);
      expect(determineReviewQuality(true, Number.NaN)).toBe(4);
    });
  });
});
