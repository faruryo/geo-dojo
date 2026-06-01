'use client';

import { useQuery } from '@tanstack/react-query';
import { getUpcomingReviewSchedule } from '@/app/(app)/dashboard/actions';

export function useUpcomingReviewSchedule(days = 7) {
  return useQuery({
    queryKey: ['dashboard', 'srs-schedule', days],
    queryFn: () => getUpcomingReviewSchedule(days),
    staleTime: 60_000,
  });
}
