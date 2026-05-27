'use client';

import { useCompletionByMode } from '@/lib/hooks/useCompletionByMode';
import { Skeleton } from '@/components/ui/skeleton';

export function CompletionProgress({
  mode,
  region,
}: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const { data, isLoading } = useCompletionByMode(mode, region);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">全国制覇</h2>

      {isLoading || !data ? (
        <Skeleton className="h-3 w-full rounded-full" />
      ) : (
        <>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(
                  data.totalMunicipalities > 0
                    ? (data.clearedCount / data.totalMunicipalities) * 100
                    : 0,
                  100,
                )}%`,
              }}
            />
          </div>
          {data.clearedCount >= data.totalMunicipalities &&
          data.totalMunicipalities > 0 ? (
            <p className="text-center text-sm font-medium text-primary">
              {region === '全国' ? '全市区町村' : region}制覇！
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {data.clearedCount.toLocaleString()} /{' '}
              {data.totalMunicipalities.toLocaleString()} クリア
              <span className="ml-2">
                あと{' '}
                {(data.totalMunicipalities - data.clearedCount).toLocaleString()}{' '}
                件
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
