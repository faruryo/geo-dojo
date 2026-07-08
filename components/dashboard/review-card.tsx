'use client';

import Link from 'next/link';
import { ChevronRight, Repeat } from 'lucide-react';
import { useDueReviewSummary } from '@/lib/hooks/useDueReviewSummary';
import { useUpcomingReviewSchedule } from '@/lib/hooks/useUpcomingReviewSchedule';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { diffJSTCalendarDays } from '@/lib/utils/date-jst';

function formatNextDue(isoDate: string): string {
  const days = diffJSTCalendarDays(new Date(isoDate));
  if (days <= 0) return '今日';
  if (days === 1) return '明日';
  return `${days}日後`;
}

/**
 * 復習ハブ。間隔反復システムの「今やること（行動）」と「全体の状況（状態）」を
 * 1枚のカードに集約する。旧 ReviewRecommendations / ReviewProgress を統合したもの。
 * データは lib/dashboard/prefetch.ts でハイドレート済みのため初回フェッチは発生しない。
 */
export function ReviewCard() {
  const { data: summary, isLoading: summaryLoading } = useDueReviewSummary();
  const { data: schedule, isLoading: scheduleLoading } = useUpcomingReviewSchedule(7);

  if (summaryLoading || scheduleLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Repeat size={15} className="text-muted-foreground" />
          復習
        </h2>
        <Skeleton className="h-40 w-full rounded-xl" />
      </section>
    );
  }

  const dueCount = summary?.dueCount ?? 0;
  const nextDueAt = summary?.nextDueAt ?? null;
  const reviewingCount = summary?.reviewingCount ?? 0;
  const graduatedCount = summary?.graduatedCount ?? 0;
  const hasProgress = reviewingCount + graduatedCount > 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Repeat size={15} className="text-muted-foreground" />
        復習
      </h2>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-4">
        {/* 行動ブロック: 今日やること */}
        {dueCount > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{dueCount}</span>
              <span className="text-sm text-muted-foreground">件の復習期日</span>
            </div>
            <Link href="/quiz/review">
              <Button className="w-full">復習を始める</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">今日の復習はありません 🎉</p>
            {nextDueAt && (
              <p className="text-xs text-muted-foreground">
                次の復習: {formatNextDue(nextDueAt)}
              </p>
            )}
          </div>
        )}

        {/* 状態ブロック: 全体の進捗（データがある時のみ） */}
        {hasProgress && (
          <>
            <Separator />

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-primary">{reviewingCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">復習中</p>
                </div>
                <div className="w-px bg-foreground/10" />
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-green-500">{graduatedCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">定着済み</p>
                </div>
              </div>

              {schedule && schedule.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">今後7日間の予定</p>
                  <div className="flex gap-1 items-end">
                    {schedule.map((day) => {
                      const max = Math.max(...schedule.map((d) => d.count), 1);
                      const height = Math.round((day.count / max) * 100);
                      const label = day.date.slice(5); // MM-DD
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-medium text-foreground leading-none tabular-nums">
                            {day.count}
                          </span>
                          {/* h-10 の確定高トラックに対して棒の % が解決される（親が未確定だと潰れる） */}
                          <div className="flex w-full h-10 items-end" title={`${day.count}件`}>
                            <div
                              className="w-full rounded-sm bg-primary/60"
                              style={{ height: `${height}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground leading-none">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {reviewingCount > 0 && (
                <Link
                  href="/quiz/review/items"
                  className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5 text-sm hover:bg-background/80 transition-colors"
                >
                  <span>覚えている途中の市区町村を見る</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {reviewingCount}件
                    <ChevronRight size={14} />
                  </span>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
