import { HydrationBoundary } from '@tanstack/react-query';
import { getAnalyticsDehydratedState } from '@/lib/analytics/prefetch';
import { AnalyticsClient } from '@/components/analytics/analytics-client';

export const metadata = {
  title: '詳細分析 | geo-dojo',
};

export default async function AnalyticsPage() {
  const dehydratedState = await getAnalyticsDehydratedState();

  return (
    <HydrationBoundary state={dehydratedState ?? undefined}>
      <AnalyticsClient />
    </HydrationBoundary>
  );
}
