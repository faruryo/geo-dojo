import { HydrationBoundary } from '@tanstack/react-query';
import { getDashboardDehydratedState } from '@/lib/dashboard/prefetch';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

/**
 * ダッシュボード（トップ）の薄い server wrapper。
 * ファーストビュー向け read を認証1回＋Promise.all でプリフェッチし、
 * HydrationBoundary でクライアントへ渡す。制覇率推移はプリフェッチ対象外。
 */
export default async function DashboardPage() {
  const dehydratedState = await getDashboardDehydratedState();

  return (
    <HydrationBoundary state={dehydratedState ?? undefined}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
