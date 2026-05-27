'use client';

import { useDifficultyProgress } from '@/lib/hooks/useDifficultyProgress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const DIFFICULTY_CONFIG = {
  easy: { label: '入門', color: 'bg-green-500' },
  medium: { label: '中級', color: 'bg-blue-500' },
  hard: { label: '上級', color: 'bg-orange-500' },
  expert: { label: '達人', color: 'bg-red-500' },
} as const;

export function DifficultyProgress({
  mode,
  region,
}: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const { data, isLoading } = useDifficultyProgress(mode, region);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">難易度別進捗</h2>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !data ? null : (
        <div className="flex flex-col gap-3">
          {data.map((item) => {
            const config =
              DIFFICULTY_CONFIG[item.difficulty as keyof typeof DIFFICULTY_CONFIG];
            if (!config) return null;

            const percent =
              item.totalCount > 0
                ? (item.clearedCount / item.totalCount) * 100
                : 0;
            const isComplete = percent >= 100 && item.totalCount > 0;

            return (
              <div key={item.difficulty} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{config.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {item.clearedCount} / {item.totalCount} クリア
                    </span>
                    {isComplete && (
                      <Badge variant="default" className="text-[10px]">
                        制覇！
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${config.color}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
