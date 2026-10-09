import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('analytics prefetch (#119)', () => {
  it('prefetches the initial completion trend with the default filter', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/analytics/prefetch.ts'), 'utf8');
    expect(src).toContain("queryKey: queryKeys.dashboard.trend('all', 'all', '全国')");
    expect(src).toContain("getAccuracyTrendData(userId, { period: 'all', mode: 'all', region: '全国' })");
    expect(src).toContain("queryKey: queryKeys.dashboard.completionTrend('all', 'all', '全国')");
    expect(src).toContain("getCompletionTrendData(userId, { period: 'all', mode: 'all', region: '全国' })");
    expect(src).toContain("queryKey: queryKeys.dashboard.weakness('all', 'all', '全国')");
    expect(src).toContain("getWeaknessRankingData(userId, { period: 'all', mode: 'all', region: '全国' })");
  });
});
