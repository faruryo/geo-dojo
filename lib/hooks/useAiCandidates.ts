'use client';

import { useQuery } from '@tanstack/react-query';
import type { AiCandidate } from '@/lib/db/schema';

export function useAiCandidates() {
  return useQuery<AiCandidate[]>({
    queryKey: ['ai-candidates'],
    queryFn: async () => {
      const res = await fetch('/api/ai-candidates');
      if (!res.ok) throw new Error('Failed to fetch candidates');
      return res.json();
    },
    refetchInterval: 10_000, // 10秒ごとに polling（processing 中の候補確認）
  });
}
