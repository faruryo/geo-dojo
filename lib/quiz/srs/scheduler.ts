import { formatJSTDate, getJSTStartOfTomorrow } from '@/lib/utils/date-jst';

const GRADUATION_INTERVAL = 30;
const GRADUATION_REPETITIONS = 4;

export function isDue(dueDate: Date, now: Date): boolean {
  return dueDate.getTime() <= now.getTime();
}

export function shouldGraduate(interval: number, repetition: number): boolean {
  return interval >= GRADUATION_INTERVAL && repetition >= GRADUATION_REPETITIONS;
}

export interface ExistingSrsForGuard {
  lastReviewedAt: Date | null;
  dueDate: Date;
}

export function alreadyAdvancedToday(
  existing: ExistingSrsForGuard | null,
  now: Date,
): boolean {
  if (!existing || !existing.lastReviewedAt) return false;
  const isSameDay = formatJSTDate(existing.lastReviewedAt) === formatJSTDate(now);
  if (!isSameDay) return false;

  // 今日すでに正解して期日が未来（明日以降）へ前進済みの場合のみ true（スキップ対象）。
  // 期日到来中（dueDate < JST翌日開始）なら、今日回答履歴があっても復習正解で前進させる。
  const jstStartOfTomorrow = getJSTStartOfTomorrow(now);
  return existing.dueDate.getTime() >= jstStartOfTomorrow.getTime();
}
