import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';
import { PREFETCH_TIMEOUT_MS } from '@/lib/dashboard/prefetch-config';
import {
  getDashboardSummaryData,
  getStreakData,
} from '@/lib/db/queries/dashboard';
import {
  getDueReviewSummaryData,
  getUpcomingReviewScheduleData,
} from '@/lib/db/queries/srs';

/**
 * ファーストビュー（サマリ・復習・連続記録）の read を認証1回＋Promise.all で取得し dehydrate する。
 * 下部チャートは inView 後のクライアント取得に委ね、バッチ最遅を押し上げない（#66）。
 */

export async function getDashboardDehydratedState(): Promise<DehydratedState | null> {
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
      queryKey: queryKeys.dashboard.srsSummary(),
      queryFn: () => getDueReviewSummaryData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.srsSchedule(7),
      queryFn: () => getUpcomingReviewScheduleData(userId, 7),
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
