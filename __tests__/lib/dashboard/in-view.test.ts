import { describe, expect, it } from 'vitest';
import { shouldRevealFromEntries } from '@/lib/dashboard/in-view';
import { PREFETCH_TIMEOUT_MS } from '@/lib/dashboard/prefetch-config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shouldRevealFromEntries', () => {
  it.each([
    { name: 'empty', entries: [], expected: false },
    { name: 'none intersecting', entries: [{ isIntersecting: false }], expected: false },
    { name: 'one intersecting', entries: [{ isIntersecting: true }], expected: true },
    {
      name: 'mixed',
      entries: [{ isIntersecting: false }, { isIntersecting: true }],
      expected: true,
    },
  ])('$name', ({ entries, expected }) => {
    expect(shouldRevealFromEntries(entries)).toBe(expected);
  });
});

describe('dashboard prefetch policy (#66)', () => {
  it('uses a timeout above remaining first-view latency and below the old 8s hang', () => {
    expect(PREFETCH_TIMEOUT_MS).toBe(2_000);
    expect(PREFETCH_TIMEOUT_MS).toBeGreaterThan(1_585);
    expect(PREFETCH_TIMEOUT_MS).toBeLessThan(8_000);
  });

  it('prefetches only first-view reads, not below-the-fold charts', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/dashboard/prefetch.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/completionTrend/);
    expect(src).not.toMatch(/getAccuracyTrendData/);
    expect(src).not.toMatch(/getCompletionByModeData/);
    expect(src).not.toMatch(/getDifficultyProgressData/);
    expect(src).not.toMatch(/getWeaknessRankingData/);
    expect(src).toMatch(/getDashboardSummaryData/);
    expect(src).toMatch(/getDueReviewSummaryData/);
  });

  it('mounts ReviewCard without waiting for summary.totalQuestions', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'components/dashboard/dashboard-client.tsx'),
      'utf8',
    );
    expect(src).toMatch(/summaryPending \|\| hasPlayed/);
    expect(src).toMatch(/RecommendHeroCard/);
    expect(src).not.toMatch(/InViewMount/);
  });
});
