'use client';

import { useQuery } from '@tanstack/react-query';
import { getMunicipalityWeakness } from '@/app/(app)/quiz/municipality/actions';
import { queryKeys } from '@/lib/query-keys';

export function useMunicipalityWeakness() {
  return useQuery({
    queryKey: queryKeys.municipality.weakness(),
    queryFn: () => getMunicipalityWeakness(),
    staleTime: 60_000,
  });
}
