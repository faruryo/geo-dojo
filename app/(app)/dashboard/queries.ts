/**
 * @deprecated 認証非依存の純粋 read クエリ群の barrel 再エクスポート。
 * 新規コードは @/lib/db/queries 配下のモジュール（dashboard.ts / srs.ts / sql-helpers.ts）から直接 import してください。
 */
export {
  serialize,
} from '@/lib/db/queries/serialization';

export {
  type QuizModeFilter,
  notSameNameSql,
  getMasterPoolSize,
  getClearedDistinctSql,
  getFilterCondSql,
} from '@/lib/db/queries/sql-helpers';

export {
  getDashboardSummaryData,
  getAccuracyTrendData,
  getCompletionTrendData,
  getWeaknessRankingData,
  getStreakData,
  getDifficultyProgressData,
  getCompletionByModeData,
} from '@/lib/db/queries/dashboard';

export {
  type DueReviewSummaryData,
  type UpcomingReviewScheduleEntry,
  type ReviewItemFilterOpts,
  type ReviewItem,
  type ReviewItemListResult,
  type ReviewModeBreakdownEntry,
  getItemAccuracyData,
  getDueReviewSummaryData,
  getUpcomingReviewScheduleData,
  getReviewItemListData,
  getReviewModeBreakdownData,
} from '@/lib/db/queries/srs';
