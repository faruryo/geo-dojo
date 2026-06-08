import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { getCurrentUserId } from '@/lib/auth/current-user';
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
/** プリフェッチの安全弁。万一サーバ側 read が詰まっても初回描画を 300s ハングさせず、
 *  null を返してクライアント側フェッチ（従来挙動）へフォールバックさせる。
 *  ※ 一時的に診断のため引き上げ（本来 < 3s 想定）。 */
const PREFETCH_TIMEOUT_MS = 25_000;

export async function getDashboardDehydratedState(): Promise<DehydratedState | null> {
  const tAuth0 = Date.now();
  const userId = await getCurrentUserId();
  const authMs = Date.now() - tAuth0;
  if (!userId) return null;

  const queryClient = getQueryClient();

  // [PERF-DIAG] 各クエリ個別の所要時間と並列実行の効きを計測（後で除去）
  const timings: Record<string, number> = {};
  const timed = <T>(name: string, fn: () => Promise<T>) => {
    const t = Date.now();
    return fn().finally(() => {
      timings[name] = Date.now() - t;
    });
  };

  const specs: Array<{ key: readonly unknown[]; run: () => Promise<unknown>; name: string }> = [
    { name: 'summary', key: ['dashboard', 'summary'], run: () => getDashboardSummaryData(userId) },
    { name: 'accuracyTrend', key: ['dashboard', 'trend', '7d', 'all', '全国'], run: () => getAccuracyTrendData(userId, { period: '7d', mode: 'all', region: '全国' }) },
    { name: 'completionTrend', key: ['dashboard', 'completionTrend', 'all', 'all', '全国'], run: () => getCompletionTrendData(userId, { period: 'all', mode: 'all', region: '全国' }) },
    { name: 'completionByMode', key: ['dashboard', 'completion', 'all', '全国'], run: () => getCompletionByModeData(userId, { mode: 'all', region: '全国' }) },
    { name: 'difficulty', key: ['dashboard', 'difficulty', 'all', '全国'], run: () => getDifficultyProgressData(userId, { mode: 'all', region: '全国' }) },
    { name: 'weakness', key: ['dashboard', 'weakness'], run: () => getWeaknessRankingData(userId) },
    { name: 'streak', key: ['dashboard', 'streak'], run: () => getStreakData(userId) },
    { name: 'dueReviewSummary', key: ['dashboard', 'srs-summary'], run: () => getDueReviewSummaryData(userId) },
    { name: 'upcomingSchedule', key: ['dashboard', 'srs-schedule', 7], run: () => getUpcomingReviewScheduleData(userId, 7) },
  ];

  const tAll0 = Date.now();
  const prefetchAll = Promise.all(
    specs.map((s) =>
      queryClient.prefetchQuery({ queryKey: s.key, queryFn: () => timed(s.name, s.run) }),
    ),
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), PREFETCH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([prefetchAll.then(() => 'ok' as const), timeout]);
    const allMs = Date.now() - tAll0;
    // [PERF-DIAG]
    console.log(
      `[dash-prefetch] auth=${authMs}ms allParallel=${allMs}ms result=${result} per=` +
        JSON.stringify(timings),
    );
    if (result === 'timeout') {
      return null;
    }
    return dehydrate(queryClient);
  } catch (e) {
    console.log('[dash-prefetch] error', (e as Error)?.message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
