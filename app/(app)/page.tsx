import { HydrationBoundary } from '@tanstack/react-query';
import { getDashboardDehydratedState } from '@/lib/dashboard/prefetch';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

/**
 * ダッシュボード（トップ）の薄い server wrapper。
 * 初回表示の read を認証1回＋Promise.all でプリフェッチし、
 * HydrationBoundary でクライアントへ渡す（直列 Server Action 群を解消）。
 * 表示本体は DashboardClient（client）。
 */
export default async function DashboardPage() {
  const dehydratedState = await getDashboardDehydratedState();

  return (
    <HydrationBoundary state={dehydratedState ?? undefined}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
