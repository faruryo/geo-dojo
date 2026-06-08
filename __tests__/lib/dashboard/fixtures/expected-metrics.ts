/**
 * seed.ts のシードに対する主要指標のゴールデン期待値（T005 / AC4）。
 *
 * シード内訳（seed.ts buildRows）:
 *   prev(48h前): [T01/A/✓] [T01/A/✗] [T02/B/✓] [T02/A/✗]
 *   today(now):  [T03/A/✓] [T03/A/✓] [T01/B/✗]
 *
 * master 依存の coverageRate のみ環境依存のため、ここでは持たず
 * テスト側で getMasterPoolSize('all') から同一式で導出して照合する。
 */
export const expectedSummary = {
  // 全期間（7件）
  totalQuestions: 7,
  totalCorrect: 4, // ✓: T01/A, T02/B, T03/A, T03/A
  studiedCount: 3, // DISTINCT code: T01, T02, T03
  clearedCount: 3, // DISTINCT mode:code where ✓: A:T01, B:T02, A:T03
  // 当日0:00より前（4件）
  prev: {
    totalQuestions: 4,
    totalCorrect: 2, // ✓: T01/A, T02/B
    studiedCount: 2, // DISTINCT code: T01, T02
    clearedCount: 2, // DISTINCT mode:code where ✓: A:T01, B:T02
  },
} as const;

export const expectedOverallAccuracy =
  expectedSummary.totalCorrect / expectedSummary.totalQuestions; // 4/7
export const expectedPrevOverallAccuracy =
  expectedSummary.prev.totalCorrect / expectedSummary.prev.totalQuestions; // 0.5
