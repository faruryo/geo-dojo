'use client';

import Link from 'next/link';
import { useReviewRecommendations } from '@/lib/hooks/useReviewRecommendations';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function daysAgo(isoDate: string): number {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  return Math.floor((now - then) / (24 * 60 * 60 * 1000));
}

export function ReviewRecommendations() {
  const { data, isLoading } = useReviewRecommendations();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">復習おすすめ</h2>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </section>
    );
  }

  if (!data || data.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">復習おすすめ</h2>
        <EmptyState message="復習すべき市区町村はありません。新しい問題に挑戦しましょう！" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">復習おすすめ</h2>
      <ul className="flex flex-col gap-2">
        {data.map((item) => (
          <li
            key={item.municipalityCode}
            className="flex items-center justify-between rounded-lg bg-card p-3 ring-1 ring-foreground/10"
          >
            <div>
              <span className="font-medium">{item.municipalityName}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                {item.prefecture}
              </span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              最終: {daysAgo(item.lastAnsweredAt)}日前
            </span>
          </li>
        ))}
      </ul>
      <Link href="/quiz/municipality/A?weakness=true">
        <Button variant="outline" className="w-full">
          復習クイズを始める
        </Button>
      </Link>
    </section>
  );
}
