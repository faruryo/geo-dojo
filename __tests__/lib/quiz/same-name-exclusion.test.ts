import { describe, it, expect } from 'vitest';
import { isSameNameMunicipality, filterSameName, type Municipality } from '../../../lib/quiz/municipality-data';

describe('Same-name municipality exclusion logic', () => {
  describe('isSameNameMunicipality', () => {
    it('returns true when municipality name stems match prefecture name stems', () => {
      // Basic cases (City match)
      expect(isSameNameMunicipality('青森市', '青森県')).toBe(true);
      expect(isSameNameMunicipality('秋田市', '秋田県')).toBe(true);
      expect(isSameNameMunicipality('山形市', '山形県')).toBe(true);
      expect(isSameNameMunicipality('福島市', '福島県')).toBe(true);
      expect(isSameNameMunicipality('栃木市', '栃木県')).toBe(true);
      expect(isSameNameMunicipality('千葉市', '千葉県')).toBe(true);
      expect(isSameNameMunicipality('新潟市', '新潟県')).toBe(true);
      expect(isSameNameMunicipality('富山市', '富山県')).toBe(true);
      expect(isSameNameMunicipality('福井市', '福井県')).toBe(true);
      expect(isSameNameMunicipality('山梨市', '山梨県')).toBe(true);
      expect(isSameNameMunicipality('長野市', '長野県')).toBe(true);
      expect(isSameNameMunicipality('岐阜市', '岐阜県')).toBe(true);
      expect(isSameNameMunicipality('静岡市', '静岡県')).toBe(true);
      expect(isSameNameMunicipality('和歌山市', '和歌山県')).toBe(true);
      expect(isSameNameMunicipality('鳥取市', '鳥取県')).toBe(true);
      expect(isSameNameMunicipality('岡山市', '岡山県')).toBe(true);
      expect(isSameNameMunicipality('広島市', '広島県')).toBe(true);
      expect(isSameNameMunicipality('山口市', '山口県')).toBe(true);
      expect(isSameNameMunicipality('徳島市', '徳島県')).toBe(true);
      expect(isSameNameMunicipality('高知市', '高知県')).toBe(true);
      expect(isSameNameMunicipality('福岡市', '福岡県')).toBe(true);
      expect(isSameNameMunicipality('佐賀市', '佐賀県')).toBe(true);
      expect(isSameNameMunicipality('長崎市', '長崎県')).toBe(true);
      expect(isSameNameMunicipality('熊本市', '熊本県')).toBe(true);
      expect(isSameNameMunicipality('大分市', '大分県')).toBe(true);
      expect(isSameNameMunicipality('宮崎市', '宮崎県')).toBe(true);
      expect(isSameNameMunicipality('鹿児島市', '鹿児島県')).toBe(true);
      expect(isSameNameMunicipality('沖縄市', '沖縄県')).toBe(true);

      // Kyoto and Osaka (Metropolitan/Urban Prefectures)
      expect(isSameNameMunicipality('京都市', '京都府')).toBe(true);
      expect(isSameNameMunicipality('大阪市', '大阪府')).toBe(true);
    });

    it('returns false when stems do not match', () => {
      // Saitama (Hiragana vs Kanji)
      expect(isSameNameMunicipality('さいたま市', '埼玉県')).toBe(false);

      // Distractors with partial overlap
      expect(isSameNameMunicipality('市川市', '千葉県')).toBe(false);
      expect(isSameNameMunicipality('野々市町', '石川県')).toBe(false);
      expect(isSameNameMunicipality('吉川市', '埼玉県')).toBe(false);
      expect(isSameNameMunicipality('四日市市', '三重県')).toBe(false);
      expect(isSameNameMunicipality('香川町', '香川県')).toBe(true); // 香川町と香川県は幹名「香川」で一致するため true
      // Is "香川町" in Kagawa prefecture self-evident? Yes, "香川" is the same stem, so it's simple/self-evident and true is correct.
      
      // Let's test a clearly false overlap
      expect(isSameNameMunicipality('八戸市', '青森県')).toBe(false);
      expect(isSameNameMunicipality('弘前市', '青森県')).toBe(false);
    });
  });

  describe('filterSameName', () => {
    it('removes municipalities whose name match prefecture stem', () => {
      const list: Municipality[] = [
        { code: '02201', name: '青森市', prefecture: '青森県', region: '東北' },
        { code: '02202', name: '弘前市', prefecture: '青森県', region: '東北' },
        { code: '11100', name: 'さいたま市', prefecture: '埼玉県', region: '関東' },
        { code: '35203', name: '山口市', prefecture: '山口県', region: '中国' },
        { code: '35201', name: '下関市', prefecture: '山口県', region: '中国' },
      ];

      const filtered = filterSameName(list);
      expect(filtered.length).toBe(3);
      expect(filtered.map(m => m.name)).toEqual(['弘前市', 'さいたま市', '下関市']);
    });
  });
});
