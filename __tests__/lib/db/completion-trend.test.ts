import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCompletionDailyTrend, type RawCompletionRow } from '@/lib/db/queries/completion-trend';

const totals = new Map([
  ['easy', 10],
  ['medium', 10],
  ['hard', 10],
  ['expert', 10],
]);

function row(date: string, name: string): RawCompletionRow {
  return {
    date,
    difficulty: 'easy',
    municipalityCode: name,
    municipalityName: name,
    prefecture: '北海道',
    mode: 'A',
  };
}

describe('buildCompletionDailyTrend', () => {
  const periodStart = new Date('2026-10-01T00:00:00Z');

  it('keeps the cumulative rate when two or more days are older than the window', () => {
    const points = buildCompletionDailyTrend(
      [row('2026-01-01', '札幌市'), row('2026-01-02', '函館市')],
      'A',
      totals,
      40,
      periodStart,
    );
    expect(points).toEqual([
      { date: '2026-10-01', easy: 20, medium: 0, hard: 0, expert: 0, all: 5 },
    ]);
  });

  it('stays empty when fewer than two days of history exist', () => {
    expect(
      buildCompletionDailyTrend([row('2026-01-01', '札幌市')], 'A', totals, 40, periodStart),
    ).toEqual([]);
    expect(buildCompletionDailyTrend([], 'A', totals, 40, periodStart)).toEqual([]);
  });

  it('does not add a carried point when the window already has a day', () => {
    const points = buildCompletionDailyTrend(
      [row('2026-01-01', '札幌市'), row('2026-10-02', '函館市')],
      'A',
      totals,
      40,
      periodStart,
    );
    expect(points.map((p) => p.date)).toEqual(['2026-10-02']);
    expect(points[0]?.easy).toBe(20);
  });
});

describe('completion trend mode A excludes Tokyo wards', () => {
  it('drops wards from the mode A denominator and from mode A rows', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/db/queries/dashboard.ts'), 'utf8');
    const counts = src.slice(
      src.indexOf('async function fetchMasterCountsByDifficulty'),
      src.indexOf('async function fetchCompletionDenominators'),
    );
    expect(counts).toContain('notTokyoSpecialWardSql');
    expect(counts).toMatch(/cnt: sql<number>`COUNT\(\*\)`/);

    const trend = src.slice(
      src.indexOf('export async function getCompletionTrendData'),
      src.indexOf('export interface WeaknessFilterOpts'),
    );
    expect(trend).toContain("municipalityQuizResults.mode} = 'A' AND ${notSameNameSql} AND ${notTokyoSpecialWardSql}");
    expect(trend).toContain('notSameNameSql} AND ${notTokyoSpecialWardSql}');
  });
});
