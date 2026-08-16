'use client';

import { useQuery } from '@tanstack/react-query';
import { getDueReviewSummary } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useDueReviewSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.srsSummary(),
    queryFn: () => getDueReviewSummary(),
    staleTime: 60_000,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
