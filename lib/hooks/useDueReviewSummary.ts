'use client';

import { useQuery } from '@tanstack/react-query';
import { getDueReviewSummary } from '@/app/(app)/dashboard/actions';

export function useDueReviewSummary() {
  return useQuery({
    queryKey: ['dashboard', 'srs-summary'],
    queryFn: () => getDueReviewSummary(),
    staleTime: 60_000,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
