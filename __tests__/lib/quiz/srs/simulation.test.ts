import { describe, it, expect } from 'vitest';
import { FAST_ANSWER_THRESHOLD_MS } from '@/lib/quiz/srs/quality';
import { MAX_SIMULATION_STEPS, simulateStepsToGraduation } from '@/lib/quiz/srs/simulation';
import { computeSrsUpdate, type ExistingSrs } from '@/lib/quiz/srs/update';

const EF_AFTER_ONE_WRONG = 2.18; // 2.5 + (0.1 - 3 * (0.08 + 3 * 0.02))

describe('simulateStepsToGraduation', () => {
  it.each([
    { label: '誤答歴なし rep0: 2回目の正解で早期卒業', state: { easeFactor: 2.5, repetition: 0, interval: 0 }, everWrong: false, expected: 2 },
    { label: '誤答歴なし rep1: 次の正解で早期卒業', state: { easeFactor: 2.5, repetition: 1, interval: 1 }, everWrong: false, expected: 1 },
    { label: '誤答直後 EF2.18: 速答で 1→6→15 の3回目', state: { easeFactor: EF_AFTER_ONE_WRONG, repetition: 0, interval: 1 }, everWrong: true, expected: 3 },
    { label: '誤答歴あり rep2 int6 EF2.18: 速答で残り2回', state: { easeFactor: EF_AFTER_ONE_WRONG, repetition: 2, interval: 6 }, everWrong: true, expected: 2 },
    { label: '誤答歴あり rep3 int13 EF2.18: 次の速答で卒業', state: { easeFactor: EF_AFTER_ONE_WRONG, repetition: 3, interval: 13 }, everWrong: true, expected: 1 },
    { label: '誤答歴あり EF2.5 rep0: 速答で 1→6→16 の3回目', state: { easeFactor: 2.5, repetition: 0, interval: 1 }, everWrong: true, expected: 3 },
    { label: 'EF 下限 1.3 rep0: 速答で 1→6→10→17 の4回目', state: { easeFactor: 1.3, repetition: 0, interval: 1 }, everWrong: true, expected: 4 },
  ])('$label', ({ state, everWrong, expected }) => {
    expect(simulateStepsToGraduation(state, everWrong)).toBe(expected);
  });

  it('EF が NaN の壊れたデータは上限で打ち切り null を返す', () => {
    expect(simulateStepsToGraduation({ easeFactor: Number.NaN, repetition: 2, interval: 6 }, true)).toBeNull();
  });

  it('上限は 20 回', () => {
    expect(MAX_SIMULATION_STEPS).toBe(20);
  });

  it('computeSrsUpdate を10秒以内の正解で繰り返した卒業回数と一致する', () => {
    const now = new Date('2026-06-01T10:00:00Z');
    let existing: ExistingSrs = {
      easeFactor: EF_AFTER_ONE_WRONG,
      repetition: 0,
      interval: 1,
      status: 'reviewing',
      dueDate: now,
      lastReviewedAt: null,
    };
    const predicted = simulateStepsToGraduation(existing, true);

    let actual = 0;
    for (let i = 1; i <= MAX_SIMULATION_STEPS; i++) {
      const at = new Date(now.getTime() + i * 100 * 24 * 60 * 60 * 1000);
      const action = computeSrsUpdate({ ...existing, dueDate: at }, true, at, true, FAST_ANSWER_THRESHOLD_MS);
      if (action.kind !== 'upsert') throw new Error('unexpected skip');
      existing = { ...action };
      if (action.status === 'graduated') {
        actual = i;
        break;
      }
    }

    expect(predicted).toBe(actual);
    expect(predicted).not.toBe(4);
  });
});
