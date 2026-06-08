import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { createServerClient } from '@/lib/supabase/server';
import { getQueryClient } from '@/lib/get-query-client';
import {
  getDashboardSummaryData,
  getAccuracyTrendData,
  getCompletionTrendData,
  getCompletionByModeData,
  getDifficultyProgressData,
  getWeaknessRankingData,
  getStreakData,
  getDueReviewSummaryData,
  getUpcomingReviewScheduleData,
} from '@/app/(app)/dashboard/queries';

/**
 * ダッシュボード初回表示の read を「認証1回 ＋ Promise.all」で取得し dehydrate する。
 *
 * 各 queryKey は対応する lib/hooks/use*.ts と完全一致させ、クライアント部品が
 * 初回フェッチせずハイドレート済みキャッシュを読むようにする（直列 Server Action を解消）。
 * 既定フィルタ = all/全国。チャートの既定 period は accuracy='7d' / completion='all'。
 * 推薦（['recommendation']）は client localStorage 履歴に依存するためここでは prefetch せず、
 * クライアント側の単発取得（staleTime 付き）に委ねる。
 */
export async function getDashboardDehydratedState(): Promise<DehydratedState | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const userId = user.id;

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'summary'],
      queryFn: () => getDashboardSummaryData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'trend', '7d', 'all', '全国'],
      queryFn: () =>
        getAccuracyTrendData(userId, { period: '7d', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'completionTrend', 'all', 'all', '全国'],
      queryFn: () =>
        getCompletionTrendData(userId, { period: 'all', mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'completion', 'all', '全国'],
      queryFn: () =>
        getCompletionByModeData(userId, { mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'difficulty', 'all', '全国'],
      queryFn: () =>
        getDifficultyProgressData(userId, { mode: 'all', region: '全国' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'weakness'],
      queryFn: () => getWeaknessRankingData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'streak'],
      queryFn: () => getStreakData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'srs-summary'],
      queryFn: () => getDueReviewSummaryData(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'srs-schedule', 7],
      queryFn: () => getUpcomingReviewScheduleData(userId, 7),
    }),
  ]);

  return dehydrate(queryClient);
}
