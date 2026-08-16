'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => getDashboardSummary(),
    staleTime: 60_000,
  });
}
