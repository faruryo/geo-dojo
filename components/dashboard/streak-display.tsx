'use client';

import Link from 'next/link';
import { useStreak } from '@/lib/hooks/useStreak';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StreakDisplay() {
  const { data, isLoading } = useStreak();

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col items-center gap-2 py-4">
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { currentStreak, longestStreak, hasPlayedToday } = data;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-center gap-1 p-3">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold">{currentStreak}</span>
          <span className="text-sm text-muted-foreground">日連続</span>
        </div>
        <p className="text-xs text-muted-foreground">
          最長記録: {longestStreak}日
        </p>
        {!hasPlayedToday && (
          <Link
            href="/quiz/municipality"
            className="mt-1 text-xs text-amber-400 underline underline-offset-4"
          >
            今日はまだクイズをしていません
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
