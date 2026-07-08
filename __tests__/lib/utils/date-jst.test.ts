/**
 * B013: 復習の due 判定を「瞬間（now）」ではなく JST の暦日単位に揃えるための境界ヘルパー。
 * dueCount / getDueReviewItems / getUpcomingReviewScheduleData / formatNextDue が
 * 全て同じ境界（getJSTStartOfTomorrow）と同じ日数差計算（diffJSTCalendarDays）を使うことで、
 * 「今日の復習はありません」なのにカレンダーの今日に件数が出る、といった矛盾を防ぐ。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getJSTStartOfTomorrow, diffJSTCalendarDays } from '@/lib/utils/date-jst';

afterEach(() => {
  vi.useRealTimers();
});

describe('getJSTStartOfTomorrow', () => {
  it('JST 2026-07-05 10:00 → 翌日 2026-07-06 00:00 JST(=前日15:00 UTC) を返す', () => {
    // 2026-07-05 10:00 JST = 2026-07-05 01:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T01:00:00Z'));

    const result = getJSTStartOfTomorrow();

    // 2026-07-06 00:00 JST = 2026-07-05 15:00 UTC
    expect(result.toISOString()).toBe('2026-07-05T15:00:00.000Z');
  });

  it('JST 23:59 でも当日ではなく翌日 00:00 JST を返す（日付境界をまたがない）', () => {
    // 2026-07-05 23:59 JST = 2026-07-05 14:59 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T14:59:00Z'));

    const result = getJSTStartOfTomorrow();

    expect(result.toISOString()).toBe('2026-07-05T15:00:00.000Z');
  });
});

describe('diffJSTCalendarDays', () => {
  const base = new Date('2026-07-05T01:00:00Z'); // JST 2026-07-05 10:00

  it('同じ JST 暦日なら 0（数分後の due も「今日」扱い）', () => {
    const target = new Date('2026-07-05T10:00:00Z'); // JST 19:00 同日
    expect(diffJSTCalendarDays(target, base)).toBe(0);
  });

  it('base の JST 終日を過ぎていない過去でも 0（due 済み扱い）', () => {
    const target = new Date('2026-07-05T00:00:01Z'); // JST 2026-07-05 09:00:01（baseより前）
    expect(diffJSTCalendarDays(target, base)).toBe(0);
  });

  it('翌 JST 暦日なら 1（数時間後でも "明日" と誤判定しない）', () => {
    const target = new Date('2026-07-05T15:30:00Z'); // JST 2026-07-06 00:30
    expect(diffJSTCalendarDays(target, base)).toBe(1);
  });

  it('3日後の JST 暦日なら 3', () => {
    const target = new Date('2026-07-08T01:00:00Z'); // JST 2026-07-08 10:00
    expect(diffJSTCalendarDays(target, base)).toBe(3);
  });
});
