import { describe, it, expect } from 'vitest';
import {
  filterByScope,
  isScopeAvailable,
  getScopePrefectures,
  parseScopeFromSearchParams,
  serializeScopeToQueryString,
  updateSearchParamsWithScope,
  sanitizeScope,
  type Municipality,
  type MunicipalityScope,
} from '@/lib/quiz/municipality-data';

const mockMunicipalities: Municipality[] = [
  { code: '20201', name: '長野市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
  { code: '20202', name: '松本市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
  { code: '20203', name: '上田市', prefecture: '長野県', region: '中部', difficulty: 'medium' },
  { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
  { code: '13102', name: '中央区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
  { code: '27100', name: '大阪市', prefecture: '大阪府', region: '近畿', difficulty: 'easy' },
  { code: '01100', name: '札幌市', prefecture: '北海道', region: '北海道', difficulty: 'easy' },
];

describe('filterByScope', () => {
  it('地方指定（region）で指定地方の市区町村のみ抽出する', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'region',
      regions: ['中部'],
    });
    expect(result.map((m) => m.code)).toEqual(['20201', '20202', '20203']);
  });

  it('全国指定で全市区町村を返す', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'region',
      regions: ['全国'],
    });
    expect(result).toHaveLength(mockMunicipalities.length);
  });

  it('都道府県指定（prefecture）で指定都道府県の全市区町村を抽出する', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'prefecture',
      prefecture: '東京都',
    });
    expect(result.map((m) => m.code)).toEqual(['13101', '13102']);
  });

  it('都道府県＋個別コード指定（selectedCodes）で該当自治体のみ抽出する', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20202'],
    });
    expect(result.map((m) => m.code)).toEqual(['20202']);
    expect(result[0].name).toBe('松本市');
  });

  it('selectedCodes が空配列の場合は0件を返す', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: [],
    });
    expect(result).toEqual([]);
  });

  it('selectedCodes が undefined の場合は県内全件を返す', () => {
    const result = filterByScope(mockMunicipalities, {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: undefined,
    });
    expect(result.map((m) => m.code)).toEqual(['20201', '20202', '20203']);
  });
});

describe('isScopeAvailable & getScopePrefectures', () => {
  it('Mode D は単一都道府県でも利用可能である', () => {
    expect(isScopeAvailable('D', { type: 'prefecture', prefecture: '長野県' })).toBe(true);
    expect(getScopePrefectures({ type: 'prefecture', prefecture: '長野県' })).toEqual(['長野県']);
  });

  it('Mode A / B は単一都道府県では利用不可（2県以上必要）である', () => {
    expect(isScopeAvailable('A', { type: 'prefecture', prefecture: '長野県' })).toBe(false);
    expect(isScopeAvailable('B', { type: 'prefecture', prefecture: '長野県' })).toBe(false);
  });

  it('Mode A / B は2県以上の地方（例: 関東）では利用可能である', () => {
    expect(isScopeAvailable('A', { type: 'region', regions: ['関東'] })).toBe(true);
    expect(isScopeAvailable('B', { type: 'region', regions: ['関東'] })).toBe(true);
  });
});

describe('parseScopeFromSearchParams & serializeScopeToQueryString', () => {
  it('prefecture スコープパラメータを正しくパースする', () => {
    const searchParams = new URLSearchParams('scope=prefecture&pref=長野県&codes=20201,20202');
    const scope = parseScopeFromSearchParams(searchParams);
    expect(scope).toEqual({
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20202'],
    });
  });

  it('region スコープパラメータを正しくパースする', () => {
    const searchParams = new URLSearchParams('scope=region&region=関東,中部');
    const scope = parseScopeFromSearchParams(searchParams);
    expect(scope).toEqual({
      type: 'region',
      regions: ['関東', '中部'],
    });
  });

  it('パラメータ未指定時は全国の region スコープを返す', () => {
    const searchParams = new URLSearchParams('');
    const scope = parseScopeFromSearchParams(searchParams);
    expect(scope).toEqual({
      type: 'region',
      regions: ['全国'],
    });
  });

  it('serializeScopeToQueryString と parseScopeFromSearchParams の往復が一致する', () => {
    const originalScope: MunicipalityScope = {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20202'],
    };
    const query = serializeScopeToQueryString(originalScope);
    const parsed = parseScopeFromSearchParams(new URLSearchParams(query.slice(1)));
    expect(parsed).toEqual(originalScope);
  });

  it('updateSearchParamsWithScope が既存の source/count/difficulties などのパラメータを維持する', () => {
    const existingParams = new URLSearchParams('source=recommend&count=20&difficulties=hard&region=関東');
    const newScope: MunicipalityScope = {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201'],
    };
    const updated = updateSearchParamsWithScope(existingParams, newScope);
    expect(updated.get('source')).toBe('recommend');
    expect(updated.get('count')).toBe('20');
    expect(updated.get('difficulties')).toBe('hard');
    expect(updated.get('scope')).toBe('prefecture');
    expect(updated.get('pref')).toBe('長野県');
    expect(updated.get('codes')).toBe('20201');
    expect(updated.get('region')).toBeNull();
  });
});

import {
  sampleMunicipalityPool,
  computePoolStats,
  buildIdentityCodeMap,
} from '@/lib/quiz/sampling';

describe('Custom Pool + Sampling Integration', () => {
  const allMaster: Municipality[] = [
    { code: '20201', name: '長野市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
    { code: '20202', name: '松本市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
    { code: '20203', name: '上田市', prefecture: '長野県', region: '中部', difficulty: 'medium' },
    { code: '20204', name: '岡谷市', prefecture: '長野県', region: '中部', difficulty: 'hard' },
    { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
  ];
  const identityCodeMap = buildIdentityCodeMap(allMaster);

  it('都道府県スコープ内で未クリア優先（unclearedFirst）が機能する', () => {
    // Scope: 長野県
    const naganoPool = filterByScope(allMaster, { type: 'prefecture', prefecture: '長野県' });
    // Cleared: 長野市 (20201)
    const clearedCodes = new Set(['20201']);

    const sampled = sampleMunicipalityPool(naganoPool, {
      count: 2,
      mode: 'D',
      unclearedFirst: true,
      clearedCodes,
      identityCodeMap,
    });

    expect(sampled).toHaveLength(2);
    // Both sampled items should be from uncleared (松本市, 上田市, 岡谷市)
    expect(sampled.every((m) => m.code !== '20201')).toBe(true);
  });

  it('カスタム個別コード指定時に制覇進捗（computePoolStats）が正確に計算される', () => {
    // Selected codes: 20201 (長野市), 20202 (松本市)
    const customPool = filterByScope(allMaster, {
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20202'],
    });
    // Cleared: 長野市 (20201)
    const clearedCodes = new Set(['20201']);

    const stats = computePoolStats(customPool, 'D', clearedCodes, identityCodeMap);
    expect(stats.totalCount).toBe(2);
    expect(stats.clearedCount).toBe(1);
    expect(stats.percentage).toBe(50);
  });
});

describe('parseScopeFromSearchParams & sanitizeScope normalization', () => {
  it('Mode A/B では都道府県クエリが来ても地域スコープ（全国）へ安全に正規化される', () => {
    const params = new URLSearchParams('scope=prefecture&pref=長野県');
    const scopeA = parseScopeFromSearchParams(params, 'A');
    expect(scopeA).toEqual({ type: 'region', regions: ['全国'] });

    const scopeB = parseScopeFromSearchParams(params, 'B');
    expect(scopeB).toEqual({ type: 'region', regions: ['全国'] });
  });

  it('Mode D では重複コードが除外され、無効な都道府県名はフォールバックされる', () => {
    const params = new URLSearchParams('scope=prefecture&pref=長野県&codes=20201,20201,20202,');
    const scopeD = parseScopeFromSearchParams(params, 'D');
    expect(scopeD).toEqual({
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20202'],
    });

    const invalidPrefParams = new URLSearchParams('scope=prefecture&pref=火星');
    const scopeFallback = parseScopeFromSearchParams(invalidPrefParams, 'D');
    expect(scopeFallback.type).toBe('prefecture');
    if (scopeFallback.type === 'prefecture') {
      expect(scopeFallback.prefecture).toBe('東京都');
    }
  });

  it('sanitizeScope は破損した localStorage オブジェクトを拒否し、正当なスコープを正規化する', () => {
    expect(sanitizeScope(null)).toBeNull();
    expect(sanitizeScope(undefined)).toBeNull();
    expect(sanitizeScope({ type: 'region', regions: 123 })).toBeNull();
    expect(sanitizeScope({ type: 'region', regions: ['存在しない地方'] })).toBeNull();
    expect(sanitizeScope({ type: 'prefecture', prefecture: '無効な県' })).toBeNull();

    const validPref = sanitizeScope({
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20201', '20202', ''],
    });
    expect(validPref).toEqual({
      type: 'prefecture',
      prefecture: '長野県',
      selectedCodes: ['20201', '20202'],
    });

    const validRegion = sanitizeScope({
      type: 'region',
      regions: ['関東', '無効な地方'],
    });
    expect(validRegion).toEqual({
      type: 'region',
      regions: ['関東'],
    });
  });
});
