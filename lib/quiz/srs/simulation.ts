import { applySm2 } from './sm2';
import type { SrsState } from './types';

/** 壊れたデータ（EF が NaN 等）で無限に卒業しない場合の打ち切り回数。EF 下限 1.3 でも通常卒業は 9 回で到達する。 */
export const MAX_SIMULATION_STEPS = 20;

const NORMAL_QUALITY = 4;
const EARLY_GRADUATION_REPETITIONS = 2;

/**
 * 回答後の SRS 状態から、通常速度（quality=4）で正解を続けた場合に何回目で卒業するかを返す。
 *
 * `computeSrsUpdate` と同じく、誤答歴なし（`everWrong=false`）かつ repetition >= 2 の早期卒業と、
 * SM-2 の通常卒業（interval >= 30 && repetition >= 4）の両方を判定する。
 * 速答卒業（quality=5）は前提にしない。
 *
 * @returns 1..MAX_SIMULATION_STEPS の回数。上限までに卒業しなければ null。
 */
export function simulateStepsToGraduation(
  state: Pick<SrsState, 'easeFactor' | 'repetition' | 'interval'>,
  everWrong: boolean,
): number | null {
  let current: SrsState = { ...state, status: 'reviewing' };
  for (let step = 1; step <= MAX_SIMULATION_STEPS; step++) {
    const result = applySm2(current, NORMAL_QUALITY);
    const earlyGraduated = !everWrong && result.repetition >= EARLY_GRADUATION_REPETITIONS;
    if (earlyGraduated || result.graduated) return step;
    current = result;
  }
  return null;
}
