'use client';

import { useQuery } from '@tanstack/react-query';
import { getStreak } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useStreak() {
  return useQuery({
    queryKey: queryKeys.dashboard.streak(),
    queryFn: () => getStreak(),
    staleTime: 60_000,
  });
}
