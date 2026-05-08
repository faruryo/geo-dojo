'use client';

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

  const cards = data?.cards ?? [];
  const current = cards[0];

  async function handleRate(rating: Rating) {
    if (!current) return;

    await fetch('/api/study/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: current.id, rating }),
    });

    await queryClient.invalidateQueries({ queryKey: ['cards', 'due'] });
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
    <div className="flex flex-col h-full p-4 gap-4">
      {/* 進捗 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground shrink-0">
        <span>残り {cards.length} 枚</span>
      </div>

      {/* カードエリア: 縦長画像でもスクロール可能、ボタンを押し出さない */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {current && <FlashCard card={current} />}
      </div>

      <div className="shrink-0">
        <RatingButtons onRate={handleRate} />
      </div>
    </div>
  );
}
