'use client';

import { useQuery } from '@tanstack/react-query';
import { getCompletionTrend } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useCompletionTrend(
  period: '7d' | '30d' | 'all',
  mode: 'all' | 'A' | 'B' | 'C' | 'D',
  region: string = '全国',
) {
  return useQuery({
    queryKey: queryKeys.dashboard.completionTrend(period, mode, region),
    queryFn: () => getCompletionTrend({ period, mode, region }),
    staleTime: 60_000,
  });
}
