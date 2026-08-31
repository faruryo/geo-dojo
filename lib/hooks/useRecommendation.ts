'use client';

import { useQuery } from '@tanstack/react-query';
import { getRecommendation } from '@/app/(app)/quiz/municipality/actions';
import {
  readRecommendationHistory,
  readRecommendClientState,
  markSwapConsumedIfRecommended,
} from '@/lib/quiz/recommendation/history-cache';
import { getBrowserUserId } from '@/lib/auth/browser-user';
import { queryKeys } from '@/lib/query-keys';

export function useRecommendation() {
  const userQuery = useQuery({
    queryKey: queryKeys.browserUserId,
    queryFn: getBrowserUserId,
    staleTime: Infinity,
  });
  const userId = userQuery.data;

  return useQuery({
    queryKey: queryKeys.recommendation.user(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('recommendation query ran without user');
      const history = readRecommendationHistory(userId);
      const client = readRecommendClientState(userId);
      const rec = await getRecommendation({
        excludeCodes: history?.lastCodes ?? [],
        client,
      });
      markSwapConsumedIfRecommended(userId, rec.mode);
      return rec;
    },
    // summary の undefined→loaded 遷移でヒーローカードが再マウントしても
    // キャッシュを再利用し二重フェッチ（HAR で 2.5s+1.0s）を防ぐ。
    // 推薦内容は同一セッション内で安定でよいため staleTime を付与する。
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
