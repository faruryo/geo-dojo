'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccuracyTrend } from '@/app/(app)/dashboard/actions';

export function useAccuracyTrend(
  period: '7d' | '30d' | 'all',
  mode: 'all' | 'A' | 'B' | 'C' | 'D',
  region: string = '全国',
) {
  return useQuery({
    queryKey: ['dashboard', 'trend', period, mode, region],
    queryFn: () => getAccuracyTrend({ period, mode, region }),
    staleTime: 60_000,
  });
}
