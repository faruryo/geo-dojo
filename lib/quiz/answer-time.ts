/**
 * PostgreSQL の integer (signed 32-bit int) 最大値
 */
export const MAX_ANSWER_TIME_MS = 2_147_483_647;

/**
 * 解答時間 (answerTimeMs) の正規化・バリデーション関数。
 * 0 以上 2,147,483,647 (PostgreSQL integer 上限) 以下の有限な数値を四捨五入して整数で返す。
 * 範囲外または不正な値は DB INSERT エラーを避けるため null を返す。
 */
export function normalizeAnswerTimeMs(input: unknown): number | null {
  if (
    typeof input === 'number' &&
    Number.isFinite(input) &&
    input >= 0 &&
    input <= MAX_ANSWER_TIME_MS
  ) {
    return Math.round(input);
  }
  return null;
}
