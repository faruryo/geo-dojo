'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { useDueReviewSummary } from '@/lib/hooks/useDueReviewSummary';
import { getDueReviewItems } from './actions';
import { buildReviewQuestions } from '@/lib/quiz/review-questions';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { Question } from '@/components/quiz/quiz-runner';
import { type Difficulty, type Municipality } from '@/lib/quiz/municipality-data';

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
}

type Phase = 'loading' | 'empty' | 'playing' | 'result';

export default function ReviewPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const queryClient = useQueryClient();

  const { data: masterData, isLoading: masterLoading } = useMunicipalityMaster();
  const { data: dueSummaryData, isLoading: dueSummaryLoading } = useDueReviewSummary();

  const allMunicipalities: Municipality[] = useMemo(
    () =>
      (masterData ?? []).map((m) => ({
        code: m.code,
        name: m.name,
        prefecture: m.prefecture,
        region: m.region,
        difficulty: m.difficulty as Difficulty,
      })),
    [masterData],
  );

  const loadBatch = useCallback(async () => {
    try {
      const items = await getDueReviewItems({ limit: 20 });
      if (items.length === 0) {
        setPhase('empty');
        return;
      }

      const qs = buildReviewQuestions(items, allMunicipalities);
      if (qs.length === 0) {
        setPhase('empty');
        return;
      }

      setQuestions(qs);
      setPhase('playing');
    } catch {
      setPhase('empty');
    }
  }, [allMunicipalities]);

  useEffect(() => {
    if (masterLoading || allMunicipalities.length === 0 || phase !== 'loading') return;
    loadBatch();
  }, [masterLoading, allMunicipalities, phase, loadBatch]);

  // ─── Loading ──────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">復習問題を読み込み中...</p>
      </div>
    );
  }

  // ─── Empty ────────────────────────────────────────────────────────

  if (phase === 'empty') {
    return (
      <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          ダッシュボードに戻る
        </Link>
        <div className="text-center py-10">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-xl font-semibold mb-2">今日の復習はありません</h2>
          <p className="text-sm text-muted-foreground">
            次の復習期日になったらまた挑戦しましょう。
          </p>
        </div>
        <Link href="/">
          <Button className="w-full" variant="outline">ダッシュボードへ</Button>
        </Link>
      </div>
    );
  }

  // ─── Result ───────────────────────────────────────────────────────

  if (phase === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const accuracy = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;

    const dueCount = dueSummaryData?.dueCount;
    const showContinueButton = !dueSummaryLoading && (dueSummaryData === undefined || (typeof dueCount === 'number' && dueCount > 0));
    const continueLabel =
      typeof dueCount === 'number' && dueCount > 0 ? `続けて復習する（残り${dueCount}件）` : '続けて復習する';

    return (
      <div className="flex flex-col gap-4 p-4 max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          ダッシュボードに戻る
        </Link>
        <h2 className="text-xl font-semibold text-center">復習完了</h2>
        <div className="text-center text-4xl font-bold text-primary">
          {correct} / {results.length}
        </div>
        <p className="text-center text-muted-foreground text-sm">正答率 {accuracy}%</p>

        {wrong.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-sm font-medium mb-2">まだ苦手な市区町村：</p>
            <div className="flex flex-wrap gap-1.5">
              {wrong.map((r, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive"
                >
                  {r.name}（{r.prefecture}）
                </span>
              ))}
            </div>
          </div>
        )}

        {showContinueButton && (
          <Button
            className="w-full"
            onClick={() => {
              setPhase('loading');
            }}
          >
            {continueLabel}
          </Button>
        )}
        <Link href="/?recommend=open">
          <Button className="w-full">✨ 今日のおすすめクイズを試す</Button>
        </Link>
        <Link href="/">
          <Button className="w-full" variant="outline">ダッシュボードへ</Button>
        </Link>
      </div>
    );
  }

  // ─── Playing ──────────────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={() => setPhase('empty')}
      onComplete={async (completedResults) => {
        setResults(completedResults);
        await queryClient.invalidateQueries({ queryKey: ['dashboard', 'srs-summary'] });
        setPhase('result');
      }}
    />
  );
}
