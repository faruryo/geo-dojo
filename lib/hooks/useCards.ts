'use client';

import { useQuery } from '@tanstack/react-query';
import type { Card } from '@/lib/db/schema';

export function useCards(tags?: string[]) {
  const params = new URLSearchParams();
  if (tags?.length) params.set('tags', tags.join(','));

  return useQuery<Card[]>({
    queryKey: ['cards', 'list', tags],
    queryFn: async () => {
      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) throw new Error('Failed to fetch cards');
      return res.json();
    },
  });
}
