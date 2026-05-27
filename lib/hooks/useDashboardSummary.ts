'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/app/(app)/dashboard/actions';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => getDashboardSummary(),
    staleTime: 60_000,
  });
}
