'use client';

import { RefreshCw } from 'lucide-react';
import type { PoolStats } from '@/lib/quiz/sampling';

interface QuizPoolProgressProps {
  readonly stats: PoolStats;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly onRetry?: () => void;
}

export function QuizPoolProgress({
  stats,
  isLoading,
  isError,
  onRetry,
}: Readonly<QuizPoolProgressProps>) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border animate-pulse">
        <div className="h-4 bg-muted rounded w-28" />
        <div className="h-2 flex-1 bg-muted rounded-full ml-auto" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-destructive/30 text-xs text-destructive">
        <span>進捗の読み込みに失敗しました</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 font-medium hover:underline text-destructive"
          >
            <RefreshCw size={12} />
            再試行
          </button>
        )}
      </div>
    );
  }

  if (stats.totalCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-card border border-border">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">制覇進捗</span>
        <span className="font-semibold text-foreground">
          {stats.clearedCount} / {stats.totalCount} 問クリア ({stats.percentage}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${stats.percentage}%` }}
        />
      </div>
    </div>
  );
}
