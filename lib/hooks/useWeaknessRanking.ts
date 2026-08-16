'use client';

import { useQuery } from '@tanstack/react-query';
import { getWeaknessRanking } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useWeaknessRanking() {
  return useQuery({
    queryKey: queryKeys.dashboard.weakness(),
    queryFn: () => getWeaknessRanking(),
    staleTime: 60_000,
  });
}
