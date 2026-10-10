import { describe, expect, it } from 'vitest';
import {
  analyticsPeriodStorageKey,
  readAnalyticsPeriod,
  writeAnalyticsPeriod,
} from '@/lib/analytics/period-preference';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

describe('analytics period preference', () => {
  it('学習者ごとのキーで読み書きする', () => {
    const storage = memory();
    writeAnalyticsPeriod(storage, 'user-a', '30d');
    expect(storage.data.get(analyticsPeriodStorageKey('user-a'))).toBe('30d');
    expect(readAnalyticsPeriod(storage, 'user-a')).toBe('30d');
    expect(readAnalyticsPeriod(storage, 'user-b')).toBeNull();
  });

  it('空と不正値は null', () => {
    const storage = memory();
    expect(readAnalyticsPeriod(storage, 'user-a')).toBeNull();
    storage.setItem(analyticsPeriodStorageKey('user-a'), 'year');
    expect(readAnalyticsPeriod(storage, 'user-a')).toBeNull();
    storage.setItem(analyticsPeriodStorageKey('user-a'), '');
    expect(readAnalyticsPeriod(storage, 'user-a')).toBeNull();
  });

  it('storage が投げても null', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readAnalyticsPeriod(storage, 'user-a')).toBeNull();
  });

  it('他の学習者の値は消さない', () => {
    const storage = memory();
    writeAnalyticsPeriod(storage, 'user-a', '7d');
    writeAnalyticsPeriod(storage, 'user-b', 'all');
    expect(readAnalyticsPeriod(storage, 'user-a')).toBe('7d');
    expect(readAnalyticsPeriod(storage, 'user-b')).toBe('all');
  });
});
