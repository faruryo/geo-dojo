'use client';

import { Repeat, Calendar } from 'lucide-react';
import { useUpcomingReviewSchedule } from '@/lib/hooks/useUpcomingReviewSchedule';
import { fillUpcomingDays, getTomorrowReviewCount } from '@/lib/quiz/srs/schedule-helper';
import { Skeleton } from '@/components/ui/skeleton';

export function UpcomingReviewMini({ days = 7 }: Readonly<{ days?: number }>) {
  const { data: schedule, isLoading, isFetching, isError } = useUpcomingReviewSchedule(days);

  if (isLoading || isFetching) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (isError || !schedule) {
    return null;
  }

  const tomorrowCount = getTomorrowReviewCount(schedule);
  const filledDays = fillUpcomingDays(schedule, days);
  const maxCount = Math.max(...filledDays.map((d) => d.count), 1);

  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Repeat size={13} />
          <span>明日の復習予定</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-primary tabular-nums">
            {tomorrowCount}
          </span>
          <span className="text-xs text-muted-foreground">件</span>
        </div>
      </div>

      <div className="pt-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
          <Calendar size={11} />
          <span>今後{days}日間の予定</span>
        </div>
        <div className="flex gap-1 items-end">
          {filledDays.map((day) => {
            const height = Math.round((day.count / maxCount) * 100);
            const label = day.date.slice(5); // MM-DD
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-medium text-foreground leading-none tabular-nums">
                  {day.count}
                </span>
                <div className="flex w-full h-8 items-end" title={`${day.date}: ${day.count}件`}>
                  <div
                    className="w-full rounded-sm bg-primary/60"
                    style={{ height: `${height}%`, minHeight: day.count > 0 ? '3px' : '0' }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground leading-none scale-90">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
