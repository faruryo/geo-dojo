import { describe, expect, it } from 'vitest';
import type { Municipality } from '@/lib/quiz/municipality-data';
import {
  sampleMunicipalityPool,
  computePoolStats,
  buildQuizQuestions,
  buildIdentityCodeMap,
  type MunicipalityWeakness,
} from '@/lib/quiz/sampling';

function createMockItem(
  code: string,
  name: string,
  prefecture: string,
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'easy'
): Municipality {
  return {
    code,
    name,
    prefecture,
    difficulty,
    region: '関東',
    kana: name,
  };
}

describe('sampleMunicipalityPool & computePoolStats (Pure Quiz Sampler)', () => {
  const itemA1 = createMockItem('01001', '府中市', '東京都', 'medium');
  const itemA2 = createMockItem('01002', '府中市', '広島県', 'hard'); // 同名・他県・難易度違い
  const itemB1 = createMockItem('02001', '静岡市葵区', '静岡県', 'medium');
  const itemB2 = createMockItem('02002', '静岡市駿河区', '静岡県', 'hard'); // 政令市区・同一県・難易度違い
  const itemC = createMockItem('03001', '横浜市', '神奈川県', 'easy');
  const itemD = createMockItem('04001', '川崎市', '神奈川県', 'easy');
  const itemE = createMockItem('05001', '相模原市', '神奈川県', 'easy');

  const allMockMaster = [itemA1, itemA2, itemB1, itemB2, itemC, itemD, itemE];
  const identityCodeMap = buildIdentityCodeMap(allMockMaster);

  describe('computePoolStats', () => {
    it('Mode A: counts distinct names for total and cleared stats', () => {
      // Pool contains itemA1 (府中市 東京) and itemC (横浜市)
      const pool = [itemA1, itemC];
      // 01002 (府中市 広島) is cleared
      const clearedCodes = new Set(['01002']);

      const stats = computePoolStats(pool, 'mode_a', clearedCodes, identityCodeMap);
      // Total distinct names in pool: 府中市, 横浜市 => 2
      expect(stats.totalCount).toBe(2);
      // 府中市 is cleared via 01002 (sibling code across difficulty/prefecture)
      expect(stats.clearedCount).toBe(1);
      expect(stats.percentage).toBe(50);
    });

    it('Mode B/C/D: counts distinct (name, prefecture) pairs for total and cleared stats', () => {
      // Pool contains itemB1 (静岡市葵区 静岡県) and itemC (横浜市 神奈川県)
      const pool = [itemB1, itemC];
      // 02002 (静岡市駿河区) is cleared
      const clearedCodes = new Set(['02002']);

      const stats = computePoolStats(pool, 'mode_b', clearedCodes, identityCodeMap);
      // Total distinct (name, prefecture): 静岡市 (normalized), 横浜市 => 2
      expect(stats.totalCount).toBe(2);
      // 静岡市 is cleared via sibling ward 02002
      expect(stats.clearedCount).toBe(1);
      expect(stats.percentage).toBe(50);
    });
  });

  describe('sampleMunicipalityPool - unclearedFirst behavior', () => {
    const pool = [itemC, itemD, itemE]; // 横浜市, 川崎市, 相模原市

    it('samples exclusively from uncleared items when uncleared count >= requested count', () => {
      const clearedCodes = new Set(['03001']); // 横浜市 is cleared, 川崎市 & 相模原市 are uncleared
      const sampled = sampleMunicipalityPool(pool, {
        count: 2,
        mode: 'mode_b',
        unclearedFirst: true,
        clearedCodes,
        identityCodeMap,
      });

      expect(sampled).toHaveLength(2);
      const sampledCodes = sampled.map((i) => i.code);
      expect(sampledCodes).toContain('04001'); // 川崎市
      expect(sampledCodes).toContain('05001'); // 相模原市
      expect(sampledCodes).not.toContain('03001'); // 横浜市 excluded
    });

    it('fills remaining slots with cleared items when uncleared count < requested count', () => {
      const clearedCodes = new Set(['03001', '04001']); // 横浜市 & 川崎市 cleared, 相模原市 uncleared
      const sampled = sampleMunicipalityPool(pool, {
        count: 3,
        mode: 'mode_b',
        unclearedFirst: true,
        clearedCodes,
        identityCodeMap,
      });

      expect(sampled).toHaveLength(3);
      expect(sampled[0].code).toBe('05001'); // 相模原市 (uncleared first)
      const restCodes = sampled.slice(1).map((i) => i.code);
      expect(restCodes).toContain('03001');
      expect(restCodes).toContain('04001');
    });

    it('falls back to sampling from all cleared items when 100% cleared (0 uncleared)', () => {
      const clearedCodes = new Set(['03001', '04001', '05001']); // all cleared
      const sampled = sampleMunicipalityPool(pool, {
        count: 2,
        mode: 'mode_b',
        unclearedFirst: true,
        clearedCodes,
        identityCodeMap,
      });

      expect(sampled).toHaveLength(2);
      expect(['03001', '04001', '05001']).toContain(sampled[0].code);
      expect(['03001', '04001', '05001']).toContain(sampled[1].code);
    });

    it('recognizes cross-difficulty cleared status for sibling codes', () => {
      // Target pool has only medium itemB1 (静岡市葵区)
      const targetPool = [itemB1, itemC];
      // Cleared code is 02002 (静岡市駿河区 - hard, not in pool)
      const clearedCodes = new Set(['02002']);

      const sampled = sampleMunicipalityPool(targetPool, {
        count: 1,
        mode: 'mode_b',
        unclearedFirst: true,
        clearedCodes,
        identityCodeMap,
      });

      // 静岡市 is recognized as cleared via 02002, so uncleared itemC (横浜市) is chosen
      expect(sampled[0].code).toBe('03001');
    });
  });

  describe('sampleMunicipalityPool - deterministic RNG injection', () => {
    it('uses injected pseudo-random generator deterministically', () => {
      const pool = [itemC, itemD, itemE];
      let callCount = 0;
      const fakeRng = () => {
        callCount++;
        return 0.99;
      };

      const sampled = sampleMunicipalityPool(pool, {
        count: 2,
        mode: 'mode_b',
        unclearedFirst: false,
        random: fakeRng,
      });

      expect(sampled).toHaveLength(2);
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('Combination of unclearedFirst and weaknessFirst', () => {
    it('prioritizes weakness within uncleared pool, then weakness within cleared pool', () => {
      const pool = [itemC, itemD, itemE];
      const clearedCodes = new Set(['05001']);
      const weaknessMap = new Map<string, MunicipalityWeakness>([
        ['03001', { municipalityCode: '03001', errorRate: 0.8 }],
        ['04001', { municipalityCode: '04001', errorRate: 0.1 }],
        ['05001', { municipalityCode: '05001', errorRate: 0.9 }],
      ]);

      const sampled = sampleMunicipalityPool(pool, {
        count: 2,
        mode: 'mode_b',
        unclearedFirst: true,
        weaknessFirst: true,
        clearedCodes,
        weaknessMap,
        identityCodeMap,
        random: () => 0.0,
      });

      expect(sampled).toHaveLength(2);
      const codes = sampled.map((i) => i.code);
      expect(codes).toContain('03001');
      expect(codes).toContain('04001');
      expect(codes).not.toContain('05001');
    });
  });

  describe('buildQuizQuestions helper', () => {
    it('integrates pool filtering and sampling into questions', () => {
      const questions = buildQuizQuestions(allMockMaster, {
        region: '関東',
        difficulty: 'easy',
        count: 2,
        mode: 'mode_b',
        unclearedFirst: true,
        clearedCodes: new Set(['03001']),
        identityCodeMap,
      });

      expect(questions.length).toBeLessThanOrEqual(2);
    });
  });
});
