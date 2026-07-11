import { describe, it, expect } from 'vitest';
import { isModeAvailable } from '@/lib/quiz/municipality-data';

describe('isModeAvailable with regions', () => {
  it('should return true for Mode B with multiple regions (e.g., Kanto)', () => {
    expect(isModeAvailable('B', ['関東'])).toBe(true);
  });

  it('should return false for Mode B with only Hokkaido region (since it only has 1 prefecture)', () => {
    expect(isModeAvailable('B', ['北海道'])).toBe(false);
  });

  it('should return true for Mode B with multiple regions combined (e.g., Hokkaido + Tohoku)', () => {
    expect(isModeAvailable('B', ['北海道', '東北'])).toBe(true);
  });

  it('should return true for Mode B when regions is empty (representing "全国")', () => {
    expect(isModeAvailable('B', [])).toBe(true);
  });

  it('should return true for Mode B when regions contains "全国"', () => {
    expect(isModeAvailable('B', ['全国'])).toBe(true);
  });

  it('should return false for Mode A with only Hokkaido region (since it only has 1 prefecture)', () => {
    expect(isModeAvailable('A', ['北海道'])).toBe(false);
  });

  it('should return true for Mode A with multiple regions combined (e.g., Hokkaido + Tohoku)', () => {
    expect(isModeAvailable('A', ['北海道', '東北'])).toBe(true);
  });

  it('should return true for non-A/B modes even with only Hokkaido', () => {
    expect(isModeAvailable('C', ['北海道'])).toBe(true);
    expect(isModeAvailable('D', ['北海道'])).toBe(true);
  });
});
