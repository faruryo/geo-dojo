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
    // summary の undefined→loaded 遷移でヒーローカードが再マウントしても
    // キャッシュを再利用し二重フェッチ（HAR で 2.5s+1.0s）を防ぐ。
    // 推薦内容は同一セッション内で安定でよいため staleTime を付与する。
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
