'use client';

import Link from 'next/link';
import { useStreak } from '@/lib/hooks/useStreak';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Pick a praise / encouragement line based on the current streak. */
function getStreakMessage(
  currentStreak: number,
  longestStreak: number,
): { text: string; highlight: boolean } | null {
  if (currentStreak <= 0) return null;
  if (currentStreak >= 30)
    return { text: '1ヶ月継続、もう本物の習慣だ🏆', highlight: true };
  if (currentStreak >= 14)
    return { text: '2週間突破！素晴らしい🔥', highlight: true };
  if (currentStreak >= 7)
    return { text: '1週間達成！その勢いで🔥', highlight: true };
  // 自己最長を更新中（大きなマイルストーン未満のとき）
  if (currentStreak >= 2 && currentStreak >= longestStreak)
    return { text: '自己最長を更新中！🎉', highlight: true };
  if (currentStreak >= 4)
    return { text: '習慣になってきたね💪', highlight: false };
  if (currentStreak >= 2) return { text: 'その調子！', highlight: false };
  return { text: 'いいスタート！この調子で', highlight: false };
}

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
  const message = getStreakMessage(currentStreak, longestStreak);

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
        {message && (
          <p
            className={
              message.highlight
                ? 'text-xs font-medium text-primary'
                : 'text-xs text-muted-foreground'
            }
          >
            {message.text}
          </p>
        )}
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
