'use client';

import { useQuery } from '@tanstack/react-query';
import { getRecentSessions } from '@/app/(app)/dashboard/actions';

export function useRecentSessions(limit: number = 10) {
  return useQuery({
    queryKey: ['dashboard', 'sessions', limit],
    queryFn: () => getRecentSessions({ limit }),
    staleTime: 60_000,
  });
}
