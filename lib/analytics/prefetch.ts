import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';
import { PREFETCH_TIMEOUT_MS } from '@/lib/dashboard/prefetch-config';
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

  const prefetchAll = Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.summary(),
      queryFn: () => getDashboardSummaryData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.streak(),
      queryFn: () => getStreakData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.difficulty('all', '全国'),
      queryFn: () => getDifficultyProgressData(userId, { mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.trend('7d', 'all', '全国'),
      queryFn: () => getAccuracyTrendData(userId, { period: '7d', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.weakness('7d', 'all', '全国'),
      queryFn: () => getWeaknessRankingData(userId, { period: '7d', mode: 'all', region: '全国' }),
    }),
  ]);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), PREFETCH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([prefetchAll.then(() => 'ok' as const), timeout]);
    return result === 'timeout' ? null : dehydrate(queryClient);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
