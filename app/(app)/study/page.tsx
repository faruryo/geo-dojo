'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDueCards } from '@/lib/hooks/useDueCards';
import { FlashCard } from '@/components/flashcard/FlashCard';
import { RatingButtons } from '@/components/flashcard/RatingButtons';
import { submitRating } from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import type { Rating } from '@/lib/srs/algorithm';
import { BookOpen } from 'lucide-react';

export default function StudyPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useDueCards();
  const [currentIndex, setCurrentIndex] = useState(0);

  const cards = data?.cards ?? [];
  const current = cards[currentIndex];

  async function handleRate(rating: Rating) {
    if (!current) return;

    await fetch('/api/study/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: current.id, rating }),
    });

    await queryClient.invalidateQueries({ queryKey: ['cards', 'due'] });

    setCurrentIndex((i) => {
      const remaining = cards.length - 1;
      return i >= remaining ? 0 : i + 1;
    });
  }

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        エラーが発生しました。再読み込みしてください。
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <BookOpen size={48} className="text-primary" />
        <h2 className="text-xl font-semibold">今日の学習は完了！</h2>
        <p className="text-muted-foreground text-center text-sm">
          次回の出題カードがある時間になったらまた確認してください。
        </p>
        {data?.totalDue === 0 && (
          <p className="text-xs text-muted-foreground">
            カードを追加するには「カード」タブへ
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 進捗 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{currentIndex + 1} / {cards.length}</span>
        <span>残り {cards.length - currentIndex - 1} 枚</span>
      </div>

      {current && <FlashCard card={current} />}

      <RatingButtons onRate={handleRate} />
    </div>
  );
}
