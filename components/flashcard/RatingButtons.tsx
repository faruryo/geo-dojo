'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Rating } from '@/lib/srs/algorithm';

interface RatingButtonsProps {
  onRate: (rating: Rating) => Promise<void>;
}

const RATINGS: { value: Rating; label: string; sublabel: string; color: string }[] = [
  { value: 1, label: '全然', sublabel: '明日また', color: 'border-red-500/50 hover:bg-red-500/10' },
  { value: 3, label: 'うろ覚え', sublabel: '3日後', color: 'border-yellow-500/50 hover:bg-yellow-500/10' },
  { value: 5, label: '完璧', sublabel: `${2.5}日×EF後`, color: 'border-green-500/50 hover:bg-green-500/10' },
];

export function RatingButtons({ onRate }: RatingButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRate(rating: Rating) {
    if (loading || done) return;
    setLoading(true);
    await onRate(rating);
    setDone(true);
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-3 gap-3 px-1">
      {RATINGS.map(({ value, label, sublabel, color }) => (
        <button
          key={value}
          onClick={() => handleRate(value)}
          disabled={loading || done}
          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border bg-card text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${color}`}
        >
          <span className="text-base">{label}</span>
          <span className="text-xs text-muted-foreground">{sublabel}</span>
        </button>
      ))}
    </div>
  );
}
