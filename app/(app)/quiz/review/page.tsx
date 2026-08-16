'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useMunicipalityMaster } from '@/lib/hooks/useMunicipalityMaster';
import { useDueReviewSummary } from '@/lib/hooks/useDueReviewSummary';
import { queryKeys } from '@/lib/query-keys';
import { UpcomingReviewMini } from '@/components/quiz/upcoming-review-mini';
import { QuizResultCard } from '@/components/quiz/quiz-result-card';
import { getDueReviewItems } from './actions';
import { buildReviewQuestions } from '@/lib/quiz/review-questions';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { Question } from '@/components/quiz/quiz-runner';
import { type Difficulty, type Municipality } from '@/lib/quiz/municipality-data';

interface ResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
  kana?: string;
}

type Phase = 'loading' | 'empty' | 'playing' | 'result';

export default function ReviewPage() {
  const router = useRouter();
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
        kana: m.kana ?? undefined,
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
    void loadBatch();
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

    const dueCount = dueSummaryData?.dueCount;
    const showContinueButton =
      !dueSummaryLoading &&
      (dueSummaryData === undefined || (typeof dueCount === 'number' && dueCount > 0));
    const continueLabel =
      typeof dueCount === 'number' && dueCount > 0
        ? `続けて復習する（残り${dueCount}件）`
        : '続けて復習する';

    const wrongItems = wrong.map((r) => ({
      name: r.name,
      detail: r.kana ? `${r.kana} / ${r.prefecture}` : r.prefecture,
    }));

    const actions = (
      <>
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
      </>
    );

    return (
      <QuizResultCard
        correctCount={correct}
        totalCount={results.length}
        backHref="/"
        backLabel="ダッシュボードに戻る"
        weakItems={wrongItems}
        weakTitle="まだ苦手な市区町村："
        actions={actions}
      >
        <UpcomingReviewMini days={7} />
      </QuizResultCard>
    );
  }

  // ─── Playing ──────────────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={() => router.replace('/')}
      onComplete={async (completedResults) => {
        setResults(completedResults);
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        setPhase('result');
      }}
    />
  );
}
