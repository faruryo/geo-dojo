'use client';

import { useQuery } from '@tanstack/react-query';
import { getMunicipalityMaster } from '@/app/(app)/quiz/municipality/actions';
import { queryKeys } from '@/lib/query-keys';

export function useMunicipalityMaster() {
  return useQuery({
    queryKey: queryKeys.municipality.master(),
    queryFn: () => getMunicipalityMaster(),
    staleTime: 60 * 60 * 1000, // 1h — master data changes only on batch re-run
  });
}
