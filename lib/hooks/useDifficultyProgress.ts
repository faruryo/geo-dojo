'use client';

import { useQuery } from '@tanstack/react-query';
import { getDifficultyProgress } from '@/app/(app)/dashboard/actions';

export function useDifficultyProgress(
  mode: 'all' | 'A' | 'B' | 'C' | 'D' = 'all',
  region: string = '全国',
) {
  return useQuery({
    queryKey: ['dashboard', 'difficulty', mode, region],
    queryFn: () => getDifficultyProgress({ mode, region }),
    staleTime: 60_000,
  });
}
