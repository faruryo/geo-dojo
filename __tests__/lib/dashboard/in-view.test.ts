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
  it('uses a sub-2s prefetch timeout instead of the 8s hang', () => {
    expect(PREFETCH_TIMEOUT_MS).toBe(1_500);
    expect(PREFETCH_TIMEOUT_MS).toBeLessThan(2_000);
  });

  it('does not prefetch completionTrend (lazy chart)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/dashboard/prefetch.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/completionTrend/);
  });

  it('mounts ReviewCard without waiting for summary.totalQuestions', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'components/dashboard/dashboard-client.tsx'),
      'utf8',
    );
    expect(src).toMatch(/summaryPending \|\| hasPlayed/);
    expect(src).toMatch(/InViewMount/);
  });
});
