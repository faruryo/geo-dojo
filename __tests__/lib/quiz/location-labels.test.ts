import { describe, expect, it } from 'vitest';
import { locationLabel } from '@/lib/quiz/location-labels';

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
});
