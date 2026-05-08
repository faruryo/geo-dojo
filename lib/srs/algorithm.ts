import type { SrsRecord } from '@/lib/db/schema';

export type Rating = 1 | 3 | 5;

export interface SrsUpdate {
  interval: number;
  easiness: number;
  reps: number;
  dueDate: Date;
}

export function calculateNextReview(
  record: Pick<SrsRecord, 'interval' | 'easiness' | 'reps'>,
  rating: Rating,
): SrsUpdate {
  const { interval, easiness, reps } = record;

  let newInterval: number;
  let newEasiness = easiness;
  let newReps: number;

  if (reps === 0) {
    // 初回学習
    newInterval = rating === 1 ? 1 : rating === 3 ? 3 : 5;
    newReps = rating === 1 ? 0 : 1;
  } else if (rating === 1) {
    // 完全忘却 → リセット
    newInterval = 1;
    newReps = 0;
  } else {
    const factor = rating === 3 ? 1.2 : easiness;
    newInterval = Math.max(Math.round(interval * factor), rating === 3 ? 3 : 5);
    newReps = reps + 1;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + newInterval);
  dueDate.setHours(0, 0, 0, 0);

  return { interval: newInterval, easiness: newEasiness, reps: newReps, dueDate };
}
