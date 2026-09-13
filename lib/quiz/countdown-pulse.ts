/**
 * Mode D などのカウントダウン時にマップ端を明滅させるパルス判定ロジック（純粋関数）。
 */

export const COUNTDOWN_DANGER_SEC = 6;
export const COUNTDOWN_WARNING_SEC = 5;

export type MapPulseType = 'danger' | 'warning' | null;
export type FeedbackState = 'idle' | 'correct' | 'incorrect';

export function shouldShowMapPulse(
  secondsLeft: number,
  feedback: FeedbackState,
): boolean {
  if (feedback !== 'idle') return false;
  return secondsLeft > 0 && secondsLeft <= COUNTDOWN_DANGER_SEC;
}

export function getMapPulseType(secondsLeft: number): MapPulseType {
  if (secondsLeft <= 0) return null;
  if (secondsLeft <= COUNTDOWN_WARNING_SEC) return 'danger';
  if (secondsLeft === COUNTDOWN_DANGER_SEC) return 'warning';
  return null;
}
