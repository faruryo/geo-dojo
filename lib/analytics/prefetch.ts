import 'server-only';
import { type DehydratedState } from '@tanstack/react-query';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';
import { safeDehydrateWithTimeout } from '@/lib/dashboard/prefetch-helpers';
import {
  getDashboardSummaryData,
  getStreakData,
  getDifficultyProgressData,
  getAccuracyTrendData,
  getCompletionTrendData,
  getWeaknessRankingData,
} from '@/lib/db/queries/dashboard';

/**
 * 詳細分析画面（/analytics）の初回表示に必要な主要クエリを SSR プリフェッチし dehydrate する。
 * - summary: 総合サマリー（累計出題数・全体正答率・A制覇率・D制覇率）
 * - streak: 連続学習日数
 * - difficulty('all', '全国'): 難易度別クリア状況
 * - trend('all', 'all', '全国'): 初期表示は全期間の正答率推移
 * - completionTrend('all', 'all', '全国'): 初期表示は全期間の制覇推移
 * - weakness('all', 'all', '全国'): 苦手ランキング（初期は全期間/全国/全モード）
 */
export async function getAnalyticsDehydratedState(): Promise<DehydratedState | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const queryClient = getQueryClient();

  const prefetchAll = Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.difficulty('all', '全国'),
      queryFn: () => getDifficultyProgressData(userId, { mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.trend('all', 'all', '全国'),
      queryFn: () => getAccuracyTrendData(userId, { period: 'all', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.completionTrend('all', 'all', '全国'),
      queryFn: () => getCompletionTrendData(userId, { period: 'all', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.weakness('all', 'all', '全国'),
      queryFn: () => getWeaknessRankingData(userId, { period: 'all', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.summary(),
      queryFn: () => getDashboardSummaryData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.streak(),
      queryFn: () => getStreakData(userId),
    }),
  ]);

  return safeDehydrateWithTimeout(queryClient, prefetchAll);
}
