import 'server-only';
import { type DehydratedState } from '@tanstack/react-query';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';
import { safeDehydrateWithTimeout } from '@/lib/dashboard/prefetch-helpers';
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

  return safeDehydrateWithTimeout(queryClient, prefetchAll);
}
