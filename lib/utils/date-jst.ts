const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toJSTDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + JST_OFFSET_MS);
}

export function formatJSTDate(utcDate: Date): string {
  const jst = toJSTDate(utcDate);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getJSTToday(): string {
  return formatJSTDate(new Date());
}

export function getJSTDateRange(period: '7d' | '30d' | 'all'): Date | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : 30;
  const now = new Date();
  const jstNow = toJSTDate(now);
  const jstStartOfToday = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()),
  );
  const jstStart = new Date(jstStartOfToday.getTime() - days * 24 * 60 * 60 * 1000);
  return new Date(jstStart.getTime() - JST_OFFSET_MS);
}

export function getJSTStartOfToday(): Date {
  const jstNow = toJSTDate(new Date());
  const jstMidnight = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()),
  );
  return new Date(jstMidnight.getTime() - JST_OFFSET_MS);
}

export function getJSTStartOfTomorrow(): Date {
  return new Date(getJSTStartOfToday().getTime() + 24 * 60 * 60 * 1000);
}

// JST の暦日単位での日数差（ミリ秒差の切り上げだと「数分後」が「明日」判定になるため）。
// target が base と同じ JST 暦日なら 0、翌日なら 1。
export function diffJSTCalendarDays(target: Date, base: Date = new Date()): number {
  const targetDate = formatJSTDate(target);
  const baseDate = formatJSTDate(base);
  return Math.round(
    (new Date(`${targetDate}T00:00:00Z`).getTime() - new Date(`${baseDate}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

export function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
