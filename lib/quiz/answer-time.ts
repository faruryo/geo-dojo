/**
 * 解答時間 (answerTimeMs) の正規化・バリデーション関数
 */
export function normalizeAnswerTimeMs(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) {
    return Math.round(input);
  }
  return null;
}
