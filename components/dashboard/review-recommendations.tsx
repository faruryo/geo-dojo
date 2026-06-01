'use client';

import Link from 'next/link';
import { useDueReviewSummary } from '@/lib/hooks/useDueReviewSummary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function formatNextDue(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return '今日';
  if (days === 1) return '明日';
  return `${days}日後`;
}

export function ReviewRecommendations() {
  const { data, isLoading } = useDueReviewSummary();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">今日の復習</h2>
        <Skeleton className="h-20 w-full rounded-xl" />
      </section>
    );
  }

  const dueCount = data?.dueCount ?? 0;
  const nextDueAt = data?.nextDueAt ?? null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">今日の復習</h2>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-3">
        {dueCount > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-primary">{dueCount}</span>
              <span className="text-sm text-muted-foreground">件</span>
            </div>
            <p className="text-xs text-muted-foreground">復習期日が来ています</p>
            <Link href="/quiz/review">
              <Button className="w-full">復習を始める</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">今日の復習はありません 🎉</p>
            {nextDueAt && (
              <p className="text-xs text-muted-foreground">
                次の復習: {formatNextDue(nextDueAt)}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
