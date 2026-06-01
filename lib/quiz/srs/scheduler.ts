import { formatJSTDate } from '@/lib/utils/date-jst';

const GRADUATION_INTERVAL = 30;
const GRADUATION_REPETITIONS = 4;

export function isDue(dueDate: Date, now: Date): boolean {
  return dueDate.getTime() <= now.getTime();
}

export function shouldGraduate(interval: number, repetition: number): boolean {
  return interval >= GRADUATION_INTERVAL && repetition >= GRADUATION_REPETITIONS;
}

export function alreadyAdvancedToday(lastReviewedAt: Date | null, now: Date): boolean {
  if (!lastReviewedAt) return false;
  return formatJSTDate(lastReviewedAt) === formatJSTDate(now);
}
