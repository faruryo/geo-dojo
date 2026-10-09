import { diffJSTCalendarDays, formatJSTDate, toJSTDate } from '@/lib/utils/date-jst';

export const ALL_PERIOD_WEEKLY_MAX_DAYS = 364;

export type AccuracyPeriod = '7d' | '30d' | 'all';
export type AccuracyGrain = 'day' | 'week' | 'month';

export function accuracyGrain(
  period: AccuracyPeriod,
  earliest: Date | null,
  latest: Date | null,
): AccuracyGrain {
  if (period !== 'all') return 'day';
  if (!earliest || !latest) return 'week';
  return diffJSTCalendarDays(latest, earliest) > ALL_PERIOD_WEEKLY_MAX_DAYS ? 'month' : 'week';
}

export function accuracyBucketKey(date: Date, grain: AccuracyGrain): string {
  if (grain === 'day') return formatJSTDate(date);
  const jst = toJSTDate(date);
  if (grain === 'month') {
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const day = jst.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(jst.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parsedBucket(dateKey: string): { y: number; m: number; d: number | null } | null {
  const month = /^(\d{4})-(\d{2})$/.exec(dateKey);
  if (month) return { y: Number(month[1]), m: Number(month[2]), d: null };
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (day) return { y: Number(day[1]), m: Number(day[2]), d: Number(day[3]) };
  return null;
}

export function accuracyAxisLabel(dateKey: string, allKeys: readonly string[]): string {
  const parsed = parsedBucket(dateKey);
  if (!parsed) return dateKey;
  if (parsed.d != null) return `${parsed.m}/${parsed.d}`;
  const years = new Set(allKeys.map((key) => parsedBucket(key)?.y).filter((y) => y != null));
  if (years.size > 1) return `${String(parsed.y).slice(-2)}/${parsed.m}`;
  return `${parsed.m}月`;
}

export function accuracyTooltipLabel(dateKey: string): string {
  const parsed = parsedBucket(dateKey);
  if (!parsed) return dateKey;
  if (parsed.d != null) return `${parsed.y}/${parsed.m}/${parsed.d}の週`;
  return `${parsed.y}年${parsed.m}月`;
}
