'use client';

import { useQuery } from '@tanstack/react-query';
import { getUpcomingReviewSchedule } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useUpcomingReviewSchedule(days = 7) {
  return useQuery({
    queryKey: queryKeys.dashboard.srsSchedule(days),
    queryFn: () => getUpcomingReviewSchedule(days),
    staleTime: 60_000,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
