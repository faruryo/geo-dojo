import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('analytics prefetch (#119)', () => {
  it('prefetches the initial completion trend with the default filter', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/analytics/prefetch.ts'), 'utf8');
    expect(src).toContain("queryKey: queryKeys.dashboard.completionTrend('7d', 'all', '全国')");
    expect(src).toContain("getCompletionTrendData(userId, { period: '7d', mode: 'all', region: '全国' })");
  });
});
