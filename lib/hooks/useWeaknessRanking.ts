'use client';

import { useQuery } from '@tanstack/react-query';
import { getWeaknessRanking } from '@/app/(app)/dashboard/actions';

export function useWeaknessRanking() {
  return useQuery({
    queryKey: ['dashboard', 'weakness'],
    queryFn: () => getWeaknessRanking(),
    staleTime: 60_000,
  });
}
