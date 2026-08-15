import type { ReviewQuality } from './types';

/** 速答とみなす解答時間の上限（ミリ秒）: 10秒 */
export const FAST_ANSWER_THRESHOLD_MS = 10_000;

/**
 * 回答の正誤と解答時間（ミリ秒）から SM-2 の ReviewQuality を決定する純粋関数。
 *
 * - 不正解 (`!isCorrect`): 2 (リセット)
 * - 正解かつ 10秒以内 (`answerTimeMs <= 10_000`): 5 (速答・EF加速)
 * - 正解かつ 10秒超、または解答時間なし (`answerTimeMs == null` / 不正値): 4 (通常正解・EF維持)
 */
export function determineReviewQuality(
  isCorrect: boolean,
  answerTimeMs?: number | null,
): ReviewQuality {
  if (!isCorrect) {
    return 2;
  }

  if (
    typeof answerTimeMs === 'number' &&
    !Number.isNaN(answerTimeMs) &&
    answerTimeMs >= 0 &&
    answerTimeMs <= FAST_ANSWER_THRESHOLD_MS
  ) {
    return 5;
  }

  return 4;
}
