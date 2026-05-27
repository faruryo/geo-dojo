'use client';

import { useQuery } from '@tanstack/react-query';
import { getReviewRecommendations } from '@/app/(app)/dashboard/actions';

export function useReviewRecommendations() {
  return useQuery({
    queryKey: ['dashboard', 'review'],
    queryFn: () => getReviewRecommendations(),
    staleTime: 60_000,
  });
}
