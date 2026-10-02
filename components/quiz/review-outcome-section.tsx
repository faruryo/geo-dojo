'use client';

import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatGraduatedNames,
  formatOutcomeLabel,
  formatRemainingSteps,
  type OutcomeLabel,
  type ReviewOutcomeQuestion,
  type ReviewOutcomeRow,
  type ReviewOutcomeSummaryCounts,
} from '@/lib/quiz/srs/outcome';

const CARD = 'rounded-xl bg-card ring-1 ring-foreground/10';

type ChipTone = 'success' | 'neutral' | 'warning';

function chipToneClass(tone: ChipTone): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-400/15 text-emerald-300';
    case 'warning':
      return 'bg-amber-400/15 text-amber-300';
    default:
      return 'bg-foreground/10 text-foreground';
  }
}

function SummaryChip({ tone, children }: Readonly<{ tone: ChipTone; children: React.ReactNode }>) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${chipToneClass(tone)}`}>
      {children}
    </span>
  );
}

function GraduatedHighlight({ count, names }: Readonly<{ count: number; names: readonly string[] }>) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-emerald-400/10 px-3 py-2.5 ring-1 ring-emerald-400/30">
      <span aria-hidden className="text-3xl leading-none">🎉</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-base font-bold text-emerald-300">
          <span className="text-2xl tabular-nums">{count}</span>件 定着しました
        </p>
        {names.length > 0 && (
          <p className="truncate text-xs text-emerald-200/80">{formatGraduatedNames(names)}</p>
        )}
      </div>
    </div>
  );
}

export function ReviewOutcomeSummary({
  summary,
  graduatedNames = [],
}: Readonly<{ summary: ReviewOutcomeSummaryCounts | null; graduatedNames?: readonly string[] }>) {
  return (
    <section aria-label="今回の復習の成果" className={`${CARD} flex flex-col gap-2 p-3.5`}>
      <p className="text-xs font-semibold text-muted-foreground">今回の復習の成果</p>
      {summary && summary.graduated > 0 && (
        <GraduatedHighlight count={summary.graduated} names={graduatedNames} />
      )}
      {summary ? (
        <div className="flex flex-wrap gap-1.5">
          {summary.graduated === 0 && <SummaryChip tone="success">🎉 定着 0件</SummaryChip>}
          <SummaryChip tone="neutral">🔄 復習継続 {summary.continuing}件</SummaryChip>
          {summary.saveFailed > 0 && (
            <SummaryChip tone="warning">⚠️ 保存失敗 {summary.saveFailed}件</SummaryChip>
          )}
        </div>
      ) : (
        <div className="flex gap-1.5" aria-busy="true">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      )}
    </section>
  );
}

function labelTone(label: OutcomeLabel): string {
  switch (label.kind) {
    case 'graduated':
    case 'kept':
      return 'text-emerald-400';
    case 'relapsed':
    case 'saveFailed':
      return 'text-amber-400';
    default:
      return 'text-foreground';
  }
}

function OutcomeRowLine({ row }: Readonly<{ row: ReviewOutcomeRow }>) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-muted-foreground">{row.prefecture}</span>
        <span className={`font-medium ${labelTone(row.label)}`}>{formatOutcomeLabel(row.label)}</span>
      </div>
      {row.remainingSteps !== undefined && (
        <span className="text-[11px] text-muted-foreground">{formatRemainingSteps(row.remainingSteps)}</span>
      )}
    </div>
  );
}

function OutcomeQuestionItem({ question }: Readonly<{ question: ReviewOutcomeQuestion }>) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          aria-label={question.isCorrect ? '正解' : '不正解'}
          className={question.isCorrect ? 'text-emerald-400' : 'text-destructive'}
        >
          {question.isCorrect ? '✓' : '✗'}
        </span>
        <span className="text-sm font-medium break-all">{question.name}</span>
        {question.kana && <span className="text-[11px] text-muted-foreground truncate">{question.kana}</span>}
      </div>
      <div className="flex flex-col gap-1.5 pl-4">
        {question.rows.map((row) => (
          <OutcomeRowLine key={row.code} row={row} />
        ))}
      </div>
    </li>
  );
}

export function ReviewOutcomeDetails({
  questions,
  defaultOpen = false,
}: Readonly<{ questions: readonly ReviewOutcomeQuestion[]; defaultOpen?: boolean }>) {
  return (
    <details className={`group ${CARD}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>問題ごとの結果（{questions.length}問）</span>
        <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col divide-y divide-foreground/10 px-3.5 pb-1">
        {questions.map((question, i) => (
          <OutcomeQuestionItem key={`${i}-${question.name}`} question={question} />
        ))}
      </ul>
    </details>
  );
}
