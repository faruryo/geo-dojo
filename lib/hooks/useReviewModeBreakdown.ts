'use client';

import { useQuery } from '@tanstack/react-query';
import { getReviewModeBreakdown } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useReviewModeBreakdown() {
  return useQuery({
    queryKey: queryKeys.dashboard.srsModeBreakdown(),
    queryFn: () => getReviewModeBreakdown(),
    staleTime: 60_000,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
