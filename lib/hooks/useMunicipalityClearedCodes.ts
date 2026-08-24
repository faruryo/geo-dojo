'use client';

import { useQuery } from '@tanstack/react-query';
import { getClearedMunicipalityCodes } from '@/app/(app)/quiz/municipality/actions';
import { queryKeys } from '@/lib/query-keys';

export function useMunicipalityClearedCodes(mode: string) {
  return useQuery({
    queryKey: queryKeys.municipality.clearedCodes(mode),
    queryFn: () => getClearedMunicipalityCodes(mode),
    staleTime: 60_000,
  });
}
