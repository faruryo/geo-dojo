'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface QuizResultWeakItem {
  readonly name: string;
  readonly detail?: string;
}

interface QuizResultCardProps {
  readonly correctCount: number;
  readonly totalCount: number;
  readonly backHref: string;
  readonly backLabel?: string;
  readonly weakItems?: readonly QuizResultWeakItem[];
  readonly weakTitle?: string;
  readonly children?: React.ReactNode;
  readonly actions: React.ReactNode;
}

export function QuizResultCard({
  correctCount,
  totalCount,
  backHref,
  backLabel = 'モード選択に戻る',
  weakItems = [],
  weakTitle = '苦手な市区町村：',
  children,
  actions,
}: Readonly<QuizResultCardProps>) {
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backLabel}
      </Link>

      <h2 className="text-xl font-semibold text-center">結果</h2>

      <div className="text-center text-4xl font-bold text-primary">
        {correctCount} / {totalCount}
      </div>
      <p className="text-center text-muted-foreground text-sm">
        正答率 {accuracy}%
      </p>

      {weakItems.length > 0 && (
        <div className="rounded-xl bg-card p-4">
          <p className="text-sm font-medium mb-2">{weakTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {weakItems.map((item, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive"
              >
                {item.name}
                {item.detail ? `（${item.detail}）` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {children}

      {actions}
    </div>
  );
}
