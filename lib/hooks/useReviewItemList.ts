'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getReviewItemList } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useReviewItemList(opts: {
  mode?: 'A' | 'B' | 'C' | 'D';
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: queryKeys.dashboard.srsList(opts.mode ?? 'all', opts.page, opts.pageSize),
    queryFn: () =>
      getReviewItemList({
        mode: opts.mode,
        limit: opts.pageSize,
        offset: opts.page * opts.pageSize,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false, // 失敗時は即空表示（リトライのバックオフで遅延させない）
  });
}
