'use client';

import { useQuery } from '@tanstack/react-query';
import { getUpcomingReviewSchedule } from '@/app/(app)/dashboard/actions';

export function useUpcomingReviewSchedule(days = 7) {
  return useQuery({
    queryKey: ['dashboard', 'srs-schedule', days],
    queryFn: () => getUpcomingReviewSchedule(days),
    staleTime: 60_000,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
