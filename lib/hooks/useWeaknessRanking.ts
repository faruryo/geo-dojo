'use client';

import { useQuery } from '@tanstack/react-query';
import { getWeaknessRanking, type WeaknessFilterOpts } from '@/app/(app)/dashboard/actions';
import { queryKeys } from '@/lib/query-keys';

export function useWeaknessRanking(opts?: WeaknessFilterOpts) {
  const period = opts?.period ?? 'all';
  const mode = opts?.mode ?? 'all';
  const region = opts?.region ?? '全国';

  return useQuery({
    queryKey: queryKeys.dashboard.weakness(period, mode, region),
    queryFn: () => getWeaknessRanking(opts),
    staleTime: 60_000,
  });
}
