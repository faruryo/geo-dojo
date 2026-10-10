import { describe, expect, it } from 'vitest';
import {
  accuracyAxisLabel,
  accuracyBucketKey,
  accuracyGrain,
  accuracyTooltipLabel,
} from '@/lib/analytics/accuracy-buckets';

const jst = (isoDate: string) => new Date(`${isoDate}T03:00:00Z`);

describe('accuracyGrain', () => {
  it('7日と30日は履歴の長さに関係なく日', () => {
    const earliest = jst('2020-01-01');
    const latest = jst('2026-01-01');
    expect(accuracyGrain('7d', earliest, latest)).toBe('day');
    expect(accuracyGrain('30d', earliest, latest)).toBe('day');
  });

  it('回答が無い全期間は週', () => {
    expect(accuracyGrain('all', null, null)).toBe('week');
  });

  it('JST暦日差364日は週、365日は月', () => {
    const earliest = jst('2025-01-01');
    expect(accuracyGrain('all', earliest, jst('2025-12-31'))).toBe('week');
    expect(accuracyGrain('all', earliest, jst('2026-01-01'))).toBe('month');
  });
});

describe('accuracyBucketKey', () => {
  it('日はJSTの暦日', () => {
    expect(accuracyBucketKey(new Date('2026-10-10T15:00:00Z'), 'day')).toBe('2026-10-11');
  });

  it('週はJSTの月曜', () => {
    expect(accuracyBucketKey(jst('2026-10-10'), 'week')).toBe('2026-10-05');
    expect(accuracyBucketKey(new Date('2026-10-10T15:00:00Z'), 'week')).toBe('2026-10-05');
  });

  it('月はJSTの暦月', () => {
    expect(accuracyBucketKey(new Date('2026-10-31T15:00:00Z'), 'month')).toBe('2026-11');
    expect(accuracyBucketKey(jst('2026-10-10'), 'month')).toBe('2026-10');
  });
});

describe('accuracy labels', () => {
  it('週の軸は月/日、説明は開始日の週', () => {
    expect(accuracyAxisLabel('2026-10-06', ['2026-10-06'])).toBe('10/6');
    expect(accuracyTooltipLabel('2026-10-06')).toBe('2026/10/6の週');
  });

  it('月の軸は年内なら月、複数年なら年/月', () => {
    expect(accuracyAxisLabel('2026-10', ['2026-09', '2026-10'])).toBe('10月');
    expect(accuracyAxisLabel('2026-01', ['2026-01'])).toBe('1月');
    expect(accuracyAxisLabel('2026-10', ['2025-12', '2026-10'])).toBe('26/10');
    expect(accuracyTooltipLabel('2026-10')).toBe('2026年10月');
  });

  it('読めないキーはそのまま返す', () => {
    expect(accuracyAxisLabel('nope', ['nope'])).toBe('nope');
    expect(accuracyTooltipLabel('nope')).toBe('nope');
  });
});
