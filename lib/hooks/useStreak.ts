'use client';

import { useQuery } from '@tanstack/react-query';
import { getStreak } from '@/app/(app)/dashboard/actions';

export function useStreak() {
  return useQuery({
    queryKey: ['dashboard', 'streak'],
    queryFn: () => getStreak(),
    staleTime: 60_000,
  });
}
