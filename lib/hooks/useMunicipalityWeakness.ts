'use client';

import { useQuery } from '@tanstack/react-query';
import { getMunicipalityWeakness } from '@/app/(app)/quiz/municipality/actions';

export function useMunicipalityWeakness() {
  return useQuery({
    queryKey: ['municipality', 'weakness'],
    queryFn: () => getMunicipalityWeakness(),
    staleTime: 60_000,
  });
}
