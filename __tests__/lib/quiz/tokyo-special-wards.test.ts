import { describe, it, expect } from 'vitest';
import {
  isTokyoSpecialWard,
  filterTokyoSpecialWards,
  filterTextModeMunicipalities,
  type Municipality,
} from '../../../lib/quiz/municipality-data';

describe('Tokyo special wards exclusion logic', () => {
  describe('isTokyoSpecialWard', () => {
    it('returns true for Tokyo special wards', () => {
      expect(isTokyoSpecialWard({ code: '13101', name: '千代田区', prefecture: '東京都', region: '関東' })).toBe(true);
      expect(isTokyoSpecialWard({ code: '13103', name: '港区', prefecture: '東京都', region: '関東' })).toBe(true);
      expect(isTokyoSpecialWard({ code: '13104', name: '新宿区', prefecture: '東京都', region: '関東' })).toBe(true);
    });

    it('returns false for non-Tokyo municipalities or Tokyo cities/villages', () => {
      // Tokyo non-ward municipalities
      expect(isTokyoSpecialWard({ code: '13201', name: '八王子市', prefecture: '東京都', region: '関東' })).toBe(false);
      expect(isTokyoSpecialWard({ code: '13202', name: '立川市', prefecture: '東京都', region: '関東' })).toBe(false);
      expect(isTokyoSpecialWard({ code: '13305', name: '瑞穂町', prefecture: '東京都', region: '関東' })).toBe(false);

      // Non-Tokyo municipalities ending with 区 (e.g. Osaka/Nagoya if ever passed, though they are under parent cities)
      expect(isTokyoSpecialWard({ code: '27103', name: '港区', prefecture: '大阪府', region: '近畿' })).toBe(false);
    });
  });

  describe('filterTokyoSpecialWards', () => {
    it('filters out Tokyo 23 special wards from municipality list', () => {
      const list: Municipality[] = [
        { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東' },
        { code: '13103', name: '港区', prefecture: '東京都', region: '関東' },
        { code: '13201', name: '八王子市', prefecture: '東京都', region: '関東' },
        { code: '14100', name: '横浜市', prefecture: '神奈川県', region: '関東' },
      ];

      const filtered = filterTokyoSpecialWards(list);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m: Municipality) => m.name)).toEqual(['八王子市', '横浜市']);
    });
  });

  describe('filterTextModeMunicipalities', () => {
    it('filters out both same-name municipalities and Tokyo 23 special wards', () => {
      const list: Municipality[] = [
        { code: '02201', name: '青森市', prefecture: '青森県', region: '東北' }, // same-name
        { code: '02202', name: '弘前市', prefecture: '青森県', region: '東北' },
        { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東' }, // Tokyo ward
        { code: '13201', name: '八王子市', prefecture: '東京都', region: '関東' },
      ];

      const filtered = filterTextModeMunicipalities(list);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m: Municipality) => m.name)).toEqual(['弘前市', '八王子市']);
    });
  });
});
