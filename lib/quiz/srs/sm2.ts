import type { ReviewQuality, SrsState, SrsUpdateResult } from './types';

const MIN_EASE_FACTOR = 1.3;
const GRADUATION_INTERVAL = 30;
const GRADUATION_REPETITIONS = 4;

export function applySm2(state: SrsState, quality: ReviewQuality): SrsUpdateResult {
  const { easeFactor, repetition, interval } = state;

  if (quality < 3) {
    // 不正解: リセット
    const newEf = Math.max(MIN_EASE_FACTOR, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    return {
      easeFactor: newEf,
      repetition: 0,
      interval: 1,
      dueInDays: 1,
      status: 'reviewing',
      graduated: false,
    };
  }

  // 正解: EF 更新（q=4 のとき増減なし）
  const newEf = Math.max(MIN_EASE_FACTOR, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const newRep = repetition + 1;
  let newInterval: number;
  if (newRep === 1) {
    newInterval = 1;
  } else if (newRep === 2) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEf);
  }

  const graduated = newInterval >= GRADUATION_INTERVAL && newRep >= GRADUATION_REPETITIONS;

  return {
    easeFactor: newEf,
    repetition: newRep,
    interval: newInterval,
    dueInDays: newInterval,
    status: graduated ? 'graduated' : 'reviewing',
    graduated,
  };
}
