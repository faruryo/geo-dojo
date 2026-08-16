'use client';

import { useQuery } from '@tanstack/react-query';
import { getCompletionByMode } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useCompletionByMode(
  mode: 'all' | 'A' | 'B' | 'C' | 'D' = 'all',
  region: string = '全国',
) {
  return useQuery({
    queryKey: queryKeys.dashboard.completion(mode, region),
    queryFn: () => getCompletionByMode({ mode, region }),
    staleTime: 60_000,
  });
}
