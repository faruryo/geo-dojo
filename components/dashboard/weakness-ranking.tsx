'use client';

import Link from 'next/link';
import { useWeaknessRanking } from '@/lib/hooks/useWeaknessRanking';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const MODE_LABELS: Record<string, string> = {
  A: 'モードA',
  B: 'モードB',
  C: 'モードC',
  D: 'モードD',
};

export function WeaknessRanking() {
  const { data, isLoading } = useWeaknessRanking();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">苦手ランキング</h2>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </section>
    );
  }

  if (!data || data.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">苦手ランキング</h2>
        <EmptyState message="苦手な市区町村はありません。素晴らしい！" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">苦手ランキング</h2>
      <ul className="flex flex-col gap-2">
        {data.map((item, i) => {
          const accuracy = 1 - item.errorRate;
          const accuracyPercent = Math.round(accuracy * 1000) / 10;
          const hue = Math.round(accuracy * 120);
          const params = new URLSearchParams({ difficulty: item.difficulty, region: item.region });
          const quizHref = `/quiz/municipality/${item.mode}?${params}`;

          return (
            <li key={`${item.municipalityCode}-${item.mode}-${i}`}>
              <Link
                href={quizHref}
                className="block rounded-lg bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium">{item.municipalityName}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {item.prefecture}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {MODE_LABELS[item.mode]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {accuracyPercent}% ({item.totalCount}回)
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${accuracyPercent}%`,
                      backgroundColor: `hsl(${hue}, 70%, 50%)`,
                    }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
