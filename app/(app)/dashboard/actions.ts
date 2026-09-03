'use server';

import { requireUserId } from '@/lib/auth/current-user';
import {
  getDashboardSummaryData,
  getAccuracyTrendData,
  getCompletionTrendData,
  getWeaknessRankingData,
  getStreakData,
  getDifficultyProgressData,
  getCompletionByModeData,
  getDueReviewSummaryData,
  getUpcomingReviewScheduleData,
  getReviewItemListData,
  getReviewModeBreakdownData,
  type QuizModeFilter,
  type WeaknessFilterOpts,
  type ReviewItemFilterOpts,
  type ReviewItem,
  type ReviewItemListResult,
  type ReviewModeBreakdownEntry,
} from './queries';

export type {
  WeaknessFilterOpts,
  ReviewItemFilterOpts,
  ReviewItem,
  ReviewItemListResult,
  ReviewModeBreakdownEntry,
};

// 以下の read 系 Server Action は、認証非依存の純粋クエリ（lib/db/queries）への
// 薄いラッパ。フィルタ変更・手動更新のオンデマンド取得経路として維持しつつ、
// 初回表示は lib/dashboard/prefetch.ts が認証1回＋Promise.all で同じ関数を呼ぶ。

// 1. getDashboardSummary
export async function getDashboardSummary() {
  const userId = await requireUserId();
  return getDashboardSummaryData(userId);
}

// 2. getAccuracyTrend
export async function getAccuracyTrend(params: {
  period: '7d' | '30d' | 'all';
  mode: QuizModeFilter;
  region: string;
}) {
  const userId = await requireUserId();
  return getAccuracyTrendData(userId, params);
}

// 2b. getCompletionTrend
export async function getCompletionTrend(params: {
  period: '7d' | '30d' | 'all';
  mode: QuizModeFilter;
  region: string;
}) {
  const userId = await requireUserId();
  return getCompletionTrendData(userId, params);
}

// 3. getWeaknessRanking
export async function getWeaknessRanking(opts?: WeaknessFilterOpts) {
  const userId = await requireUserId();
  return getWeaknessRankingData(userId, opts);
}

// 4. getStreak
export async function getStreak() {
  const userId = await requireUserId();
  return getStreakData(userId);
}

// 5. getDifficultyProgress
export async function getDifficultyProgress(params: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const userId = await requireUserId();
  return getDifficultyProgressData(userId, params);
}

// 5b. getCompletionByMode
export async function getCompletionByMode(params: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
  asOf?: Date;
}) {
  const userId = await requireUserId();
  return getCompletionByModeData(userId, params);
}

// 7. getDueReviewSummary — 今日の復習サマリ（SRS 期日駆動）
export async function getDueReviewSummary() {
  const userId = await requireUserId();
  return getDueReviewSummaryData(userId);
}

// 8. getUpcomingReviewSchedule — 今後 N 日の日別復習予定件数
export async function getUpcomingReviewSchedule(days = 7) {
  const userId = await requireUserId();
  return getUpcomingReviewScheduleData(userId, days);
}

// 9. getReviewItemList — 復習中（学習途中）のアイテム一覧（ページング+モードフィルタ）
export async function getReviewItemList(
  opts?: ReviewItemFilterOpts,
): Promise<ReviewItemListResult> {
  const userId = await requireUserId();
  return getReviewItemListData(userId, opts);
}

// 10. getReviewModeBreakdown — モード別の復習中/定着済み件数（glanceable サマリ）
export async function getReviewModeBreakdown(): Promise<ReviewModeBreakdownEntry[]> {
  const userId = await requireUserId();
  return getReviewModeBreakdownData(userId);
}
