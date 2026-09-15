import { describe, expect, it } from 'vitest';
import { locationLabel, locationKana } from '@/lib/quiz/location-labels';

describe('locationLabel', () => {
  it('distinguishes Sapporo designated-city wards', () => {
    expect(locationLabel('01101', '札幌市')).toBe('札幌市中央区');
    expect(locationLabel('01102', '札幌市')).toBe('札幌市北区');
    expect(locationLabel('01101', '札幌市')).not.toBe(locationLabel('01102', '札幌市'));
  });

  it('keeps Tokyo special ward names as-is', () => {
    expect(locationLabel('13101', '千代田区')).toBe('千代田区');
  });

  it('labels Osaka designated-city wards by code', () => {
    expect(locationLabel('27127', '大阪市')).toBe('大阪市北区');
    expect(locationLabel('27128', '大阪市')).toBe('大阪市中央区');
  });

  it('labels current Hamamatsu wards by 2024 codes', () => {
    expect(locationLabel('22138', '浜松市')).toBe('浜松市中央区');
    expect(locationLabel('22139', '浜松市')).toBe('浜松市浜名区');
    expect(locationLabel('22140', '浜松市')).toBe('浜松市天竜区');
    expect(locationLabel('22131', '浜松市')).toBe('浜松市');
  });
});

describe('locationKana', () => {
  it('returns ward kana for Sapporo designated-city wards', () => {
    expect(locationKana('01101', 'さっぽろし')).toBe('さっぽろしちゅうおうく');
    expect(locationKana('01102', 'さっぽろし')).toBe('さっぽろしきたく');
  });

  it('returns ward kana for Osaka designated-city wards', () => {
    expect(locationKana('27127', 'おおさかし')).toBe('おおさかしきたく');
    expect(locationKana('27128', 'おおさかし')).toBe('おおさかしちゅうおうく');
  });

  it('returns ward kana for Hamamatsu designated-city wards', () => {
    expect(locationKana('22138', 'はままつし')).toBe('はままつしちゅうおうく');
    expect(locationKana('22139', 'はままつし')).toBe('はままつしはまなく');
    expect(locationKana('22140', 'はままつし')).toBe('はままつしてんりゅうく');
  });

  it('falls back to provided kana for unmapped codes', () => {
    expect(locationKana('13101', 'ちよだく')).toBe('ちよだく');
    expect(locationKana('01233', 'だてし')).toBe('だてし');
    expect(locationKana('99999')).toBeUndefined();
  });
});

