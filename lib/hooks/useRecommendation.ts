'use client';

import { useQuery } from '@tanstack/react-query';
import { getRecommendation } from '@/app/(app)/quiz/municipality/actions';
import { readRecommendationHistory } from '@/lib/quiz/recommendation/history-cache';

export function useRecommendation() {
  return useQuery({
    queryKey: ['recommendation'],
    queryFn: async () => {
      const history = readRecommendationHistory();
      return await getRecommendation({
        excludeCodes: history?.lastCodes ?? [],
      });
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
