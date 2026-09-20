import { describe, it, expect } from 'vitest';
import {
  formatPopulation,
  buildDesignatedCityPopulationMap,
  resolveFeedbackItems,
} from '@/lib/quiz/municipality-population';
import type { Municipality } from '@/lib/quiz/municipality-data';

describe('formatPopulation (FR-002d)', () => {
  it('formats populations >= 10,000 in 万人 rounded to 1 decimal place', () => {
    expect(formatPopulation(44_120)).toBe('約4.4万人');
    expect(formatPopulation(2_753_862)).toBe('約275.4万人');
    expect(formatPopulation(3_777_491)).toBe('約377.7万人');
    expect(formatPopulation(10_000)).toBe('約1.0万人');
    expect(formatPopulation(10_499)).toBe('約1.0万人');
    expect(formatPopulation(10_500)).toBe('約1.1万人');
  });

  it('formats populations < 10,000 with comma separation down to 1s place', () => {
    expect(formatPopulation(6_320)).toBe('約6,320人');
    expect(formatPopulation(9_999)).toBe('約9,999人');
    expect(formatPopulation(500)).toBe('約500人');
    expect(formatPopulation(1)).toBe('約1人');
  });

  it('returns null for null, undefined, 0, or negative values', () => {
    expect(formatPopulation(null)).toBeNull();
    expect(formatPopulation(undefined)).toBeNull();
    expect(formatPopulation(0)).toBeNull();
    expect(formatPopulation(-100)).toBeNull();
  });
});

describe('buildDesignatedCityPopulationMap (FR-002a)', () => {
  it('aggregates population for all wards of designated cities with same pref and name', () => {
    const municipalities: Municipality[] = [
      { code: '22101', name: '静岡市', prefecture: '静岡県', region: '中部', population: 250_000 },
      { code: '22102', name: '静岡市', prefecture: '静岡県', region: '中部', population: 210_000 },
      { code: '22103', name: '静岡市', prefecture: '静岡県', region: '中部', population: 230_000 },
      { code: '22201', name: '沼津市', prefecture: '静岡県', region: '中部', population: 190_000 },
    ];

    const map = buildDesignatedCityPopulationMap(municipalities);
    expect(map.get('静岡県:静岡市')).toBe(690_000);
    // Non-designated city is not in map as designated city
    expect(map.has('静岡県:沼津市')).toBe(false);
  });

  it('returns null if any ward of a designated city is missing population (null/0/undefined)', () => {
    const municipalities: Municipality[] = [
      { code: '27101', name: '大阪市', prefecture: '大阪府', region: '近畿', population: 140_000 },
      { code: '27102', name: '大阪市', prefecture: '大阪府', region: '近畿', population: undefined },
      { code: '27103', name: '大阪市', prefecture: '大阪府', region: '近畿', population: 120_000 },
    ];

    const map = buildDesignatedCityPopulationMap(municipalities);
    expect(map.get('大阪府:大阪市')).toBeNull();
  });
});

describe('resolveFeedbackItems (FR-002a, FR-002b, FR-002c)', () => {
  const designatedMap = new Map<string, number | null>([
    ['静岡県:静岡市', 690_000],
    ['大阪府:大阪市', null], // missing ward
  ]);

  it('resolves single municipality for Mode B/C using aggregated designated city population', () => {
    const m: Municipality = {
      code: '22101',
      name: '静岡市',
      prefecture: '静岡県',
      region: '中部',
      kana: 'しずおかし',
      population: 250_000,
    };

    const items = resolveFeedbackItems({
      mode: 'B',
      municipality: m,
      designatedCityMap: designatedMap,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      prefecture: '静岡県',
      name: '静岡市',
      kana: 'しずおかし',
      population: 690_000,
      formattedPopulation: '約69.0万人',
    });
  });

  it('resolves single municipality for Mode D using the ward itself (FR-002b)', () => {
    const m: Municipality = {
      code: '22101',
      name: '静岡市',
      prefecture: '静岡県',
      region: '中部',
      kana: 'しずおかし',
      population: 250_000,
    };

    const items = resolveFeedbackItems({
      mode: 'D',
      municipality: m,
      designatedCityMap: designatedMap,
    });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('静岡市葵区');
    expect(items[0].kana).toBe('しずおかしあおいく');
    expect(items[0].population).toBe(250_000);
    expect(items[0].formattedPopulation).toBe('約25.0万人');
  });

  it('omits formatted population when population is missing or null', () => {
    const m: Municipality = {
      code: '27101',
      name: '大阪市',
      prefecture: '大阪府',
      region: '近畿',
      kana: 'おおさかし',
      population: 140_000,
    };

    const items = resolveFeedbackItems({
      mode: 'B',
      municipality: m,
      designatedCityMap: designatedMap,
    });

    expect(items[0].population).toBeNull();
    expect(items[0].formattedPopulation).toBeNull();
  });

  it('resolves multiple instances for Mode A without aggregating across prefectures (FR-002c)', () => {
    const instances: Municipality[] = [
      { code: '01644', name: '池田町', prefecture: '北海道', region: '北海道', kana: 'いけだちょう', population: 6_320 },
      { code: '18205', name: '池田町', prefecture: '福井県', region: '中部', kana: 'いけだちょう', population: 2_400 },
      { code: '20402', name: '池田町', prefecture: '長野県', region: '中部', kana: 'いけだまち', population: 13_500 },
      { code: '21404', name: '池田町', prefecture: '岐阜県', region: '中部', kana: 'いけだちょう', population: 23_100 },
    ];

    const items = resolveFeedbackItems({
      mode: 'A',
      instances,
      designatedCityMap: designatedMap,
    });

    expect(items).toHaveLength(4);
    expect(items[0].formattedPopulation).toBe('約6,320人');
    expect(items[1].formattedPopulation).toBe('約2,400人');
    expect(items[2].formattedPopulation).toBe('約1.4万人');
    expect(items[3].formattedPopulation).toBe('約2.3万人');
  });

  it('deduplicates multiple ward instances of a designated city to a single item in Mode A (FR-002a)', () => {
    const rawYokohamaWards: Municipality[] = [
      { code: '14101', name: '横浜市', prefecture: '神奈川県', region: '関東', kana: 'よこはまし', population: 200_000 },
      { code: '14102', name: '横浜市', prefecture: '神奈川県', region: '関東', kana: 'よこはまし', population: 250_000 },
      { code: '14103', name: '横浜市', prefecture: '神奈川県', region: '関東', kana: 'よこはまし', population: 300_000 },
    ];
    const map = new Map<string, number | null>([['神奈川県:横浜市', 3_770_000]]);

    const items = resolveFeedbackItems({
      mode: 'A',
      instances: rawYokohamaWards,
      designatedCityMap: map,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      prefecture: '神奈川県',
      name: '横浜市',
      kana: 'よこはまし',
      population: 3_770_000,
      formattedPopulation: '約377.0万人',
    });
  });
});

