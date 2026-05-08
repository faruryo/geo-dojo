'use client';

import { useQuery } from '@tanstack/react-query';
import type { Card, Annotation, SrsRecord } from '@/lib/db/schema';

export interface CardWithDetails extends Card {
  annotations: Annotation[];
  srsRecord: SrsRecord | null;
}

export interface DueCardsResponse {
  cards: CardWithDetails[];
  totalDue: number;
}

export function useDueCards() {
  return useQuery<DueCardsResponse>({
    queryKey: ['cards', 'due'],
    queryFn: async () => {
      const res = await fetch('/api/cards/due');
      if (!res.ok) throw new Error('Failed to fetch due cards');
      return res.json();
    },
  });
}
