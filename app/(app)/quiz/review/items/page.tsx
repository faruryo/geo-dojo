'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReviewItemList } from '@/lib/hooks/useReviewItemList';
import { useReviewModeBreakdown } from '@/lib/hooks/useReviewModeBreakdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type ModeFilter = 'all' | 'A' | 'B' | 'C' | 'D';

const PAGE_SIZE = 25;

const MODE_SHORT: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: '逆引き地図',
  B: '逆引き4択',
  C: '順引き4択',
  D: '順引き地図',
};

function nextDueLabel(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return '今日';
  if (days === 1) return '明日';
  return `${days}日後`;
}

export default function ReviewItemsPage() {
  const [mode, setMode] = useState<ModeFilter>('all');
  const [page, setPage] = useState(0);

  const { data: breakdown } = useReviewModeBreakdown();
  const { data, isLoading, isPlaceholderData } = useReviewItemList({
    mode: mode === 'all' ? undefined : mode,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  function changeMode(m: ModeFilter) {
    setMode(m);
    setPage(0);
  }

  const totalReviewing = breakdown?.reduce((s, b) => s + b.reviewing, 0) ?? 0;
  const totalGraduated = breakdown?.reduce((s, b) => s + b.graduated, 0) ?? 0;

  return (
    <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        ダッシュボードに戻る
      </Link>

      <div>
        <h1 className="text-xl font-semibold">覚えている途中の市区町村</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          復習中 {totalReviewing}件・定着済み {totalGraduated}件
        </p>
      </div>

      {/* glanceable: モード別サマリ表 */}
      {breakdown && (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-foreground/10">
                <th className="text-left font-medium px-3 py-2">モード</th>
                <th className="text-right font-medium px-2 py-2">復習中</th>
                <th className="text-right font-medium px-2 py-2">定着済</th>
                <th className="text-right font-medium px-3 py-2">定着率</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => {
                const sum = b.reviewing + b.graduated;
                const rate = sum > 0 ? Math.round((b.graduated / sum) * 100) : 0;
                return (
                  <tr key={b.mode} className="border-b border-foreground/5 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{b.mode}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{MODE_SHORT[b.mode]}</span>
                    </td>
                    <td className="text-right px-2 py-2 tabular-nums">{b.reviewing}</td>
                    <td className="text-right px-2 py-2 tabular-nums text-green-500">{b.graduated}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">
                      {sum > 0 ? `${rate}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* filter: モード */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'A', 'B', 'C', 'D'] as ModeFilter[]).map((m) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              mode === m
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {m === 'all' ? '全モード' : m}
          </button>
        ))}
      </div>

      {/* list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground">
            {mode === 'all' ? '復習中の市区町村はありません。' : `モード${mode}の復習中アイテムはありません。`}
          </p>
        </div>
      ) : (
        <>
          <ul className={`flex flex-col gap-1.5 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}>
            {items.map((item, i) => (
              <li
                key={`${item.municipalityName}-${item.mode}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                    {item.mode}
                  </Badge>
                  <span className="truncate text-sm">{item.municipalityName}</span>
                  {item.kana && (
                    <span className="shrink-0 text-xs text-muted-foreground">（{item.kana}）</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.accuracy && item.accuracy.total > 0 && (
                    <span
                      className={`text-xs tabular-nums ${
                        item.accuracy.correct / item.accuracy.total < 0.5
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {Math.round((item.accuracy.correct / item.accuracy.total) * 100)}%
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{nextDueLabel(item.dueDate)}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* pagination */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={14} />
              前へ
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {rangeStart}–{rangeEnd} / {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ
              <ChevronRight size={14} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
