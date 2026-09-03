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
  getWeaknessRankingData,
} from '@/lib/db/queries/dashboard';

/**
 * 詳細分析画面（/analytics）の初回表示に必要な主要クエリを SSR プリフェッチし dehydrate する。
 * - summary: 総合サマリー（累計出題数・全体正答率・A制覇率・D制覇率）
 * - streak: 連続学習日数
 * - difficulty('all', '全国'): 難易度別クリア状況
 * - trend('7d', 'all', '全国'): 初期7日間の推移
 * - weakness('7d', 'all', '全国'): 苦手ランキング（初期7日間/全国/全モード）
 */
export async function getAnalyticsDehydratedState(): Promise<DehydratedState | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const queryClient = getQueryClient();

  const prefetchTasks = [
    { queryKey: queryKeys.dashboard.summary(), queryFn: () => getDashboardSummaryData(userId) },
    { queryKey: queryKeys.dashboard.streak(), queryFn: () => getStreakData(userId) },
    {
      queryKey: queryKeys.dashboard.difficulty('all', '全国'),
      queryFn: () => getDifficultyProgressData(userId, { mode: 'all', region: '全国' }),
    },
    {
      queryKey: queryKeys.dashboard.trend('7d', 'all', '全国'),
      queryFn: () => getAccuracyTrendData(userId, { period: '7d', mode: 'all', region: '全国' }),
    },
    {
      queryKey: queryKeys.dashboard.weakness('7d', 'all', '全国'),
      queryFn: () => getWeaknessRankingData(userId, { period: '7d', mode: 'all', region: '全国' }),
    },
  ];

  const prefetchAll = Promise.all(prefetchTasks.map((task) => queryClient.prefetchQuery(task)));
  return safeDehydrateWithTimeout(queryClient, prefetchAll);
}
