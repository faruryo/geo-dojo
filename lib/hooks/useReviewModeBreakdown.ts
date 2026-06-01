'use client';

import { useQuery } from '@tanstack/react-query';
import { getReviewModeBreakdown } from '@/app/(app)/dashboard/actions';

export function useReviewModeBreakdown() {
  return useQuery({
    queryKey: ['dashboard', 'srs-mode-breakdown'],
    queryFn: () => getReviewModeBreakdown(),
    staleTime: 60_000,
  });
}
