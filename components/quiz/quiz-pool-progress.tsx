'use client';

import { RefreshCw } from 'lucide-react';
import type { PoolStats } from '@/lib/quiz/sampling';

interface QuizPoolProgressProps {
  readonly stats: PoolStats;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly onRetry?: () => void;
}

function ProgressLoading() {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border animate-pulse">
      <div className="h-4 bg-muted rounded w-28" />
      <div className="h-2 flex-1 bg-muted rounded-full ml-auto" />
    </div>
  );
}

function ProgressError({ onRetry }: { readonly onRetry?: () => void }) {
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

export function QuizPoolProgress({
  stats,
  isLoading,
  isError,
  onRetry,
}: Readonly<QuizPoolProgressProps>) {
  if (isLoading) return <ProgressLoading />;
  if (isError) return <ProgressError onRetry={onRetry} />;
  if (stats.totalCount === 0) return null;

  const isCompleted = stats.percentage === 100 && stats.totalCount > 0;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-card border border-border">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">制覇進捗</span>
          {isCompleted && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              制覇済み！
            </span>
          )}
        </div>
        <span className="font-semibold text-foreground">
          {stats.clearedCount} / {stats.totalCount} 問クリア ({stats.percentage}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isCompleted ? 'bg-emerald-500' : 'bg-primary'
          }`}
          style={{ width: `${stats.percentage}%` }}
        />
      </div>
    </div>
  );
}
