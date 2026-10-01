'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ReviewOutcomeDetails, ReviewOutcomeSummary } from '@/components/quiz/review-outcome-section';
import { toWeakResultItem } from '@/lib/quiz/quiz-results';
import { getDueReviewItems, getSrsSnapshot } from './actions';
import { buildReviewQuestions } from '@/lib/quiz/review-questions';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { Question } from '@/components/quiz/quiz-runner';
import { type Difficulty, type Municipality } from '@/lib/quiz/municipality-data';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import {
  buildReviewOutcome,
  collectSrsKeys,
  isSaveMetaConsistent,
  persistedSrsKeys,
  type ReviewOutcome,
} from '@/lib/quiz/srs/outcome';
import { MAX_SNAPSHOT_KEYS, type SrsSnapshotEntry, type SrsSnapshotKey } from '@/lib/quiz/srs/snapshot';

type Phase = 'loading' | 'empty' | 'playing' | 'result';

type OutcomeState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; outcome: ReviewOutcome };

interface ActiveBatch {
  id: number;
  questions: Question[];
  /** 出題開始前の SRS 状態。取得できなければ null で、成果表示は行わない。 */
  pre: SrsSnapshotEntry[] | null;
}

async function fetchSnapshot(keys: SrsSnapshotKey[]): Promise<SrsSnapshotEntry[] | null> {
  if (keys.length === 0) return [];
  if (keys.length > MAX_SNAPSHOT_KEYS) return null;
  try {
    return await getSrsSnapshot(keys);
  } catch (reason: unknown) {
    console.error('[review] failed to load srs snapshot', { count: keys.length, reason });
    return null;
  }
}

function canBuildOutcome(
  batch: ActiveBatch | null,
  results: readonly QuizResultEntry[],
  saveMeta: readonly QuestionSaveMeta[] | undefined,
): boolean {
  return !!batch?.pre && isSaveMetaConsistent(batch.questions, saveMeta, results.length);
}

async function resolveOutcome(
  batch: ActiveBatch,
  results: QuizResultEntry[],
  saveMeta: readonly QuestionSaveMeta[] | undefined,
): Promise<ReviewOutcome | null> {
  const { pre, questions } = batch;
  if (!pre || !isSaveMetaConsistent(questions, saveMeta, results.length)) return null;
  const post = await fetchSnapshot(persistedSrsKeys(questions, saveMeta));
  if (!post) return null;
  return buildReviewOutcome({ questions, results, meta: saveMeta, pre, post, now: new Date() });
}

export default function ReviewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResultEntry[]>([]);
  const [outcomeState, setOutcomeState] = useState<OutcomeState>({ status: 'unavailable' });
  const batchRef = useRef<ActiveBatch | null>(null);
  const batchSeqRef = useRef(0);
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
        population: m.population ?? undefined,
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

      // 1問目の保存より先に取り終えないと、回答後の値を回答前として読んでしまう。
      const pre = await fetchSnapshot(collectSrsKeys(qs));
      batchSeqRef.current += 1;
      batchRef.current = { id: batchSeqRef.current, questions: qs, pre };

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

  const handleComplete = useCallback(
    async (completedResults: QuizResultEntry[], saveMeta?: readonly QuestionSaveMeta[]) => {
      const batch = batchRef.current;
      setResults(completedResults);
      setOutcomeState(
        canBuildOutcome(batch, completedResults, saveMeta) ? { status: 'loading' } : { status: 'unavailable' },
      );
      const outcomePromise = batch ? resolveOutcome(batch, completedResults, saveMeta) : Promise.resolve(null);

      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      setPhase('result');

      const outcome = await outcomePromise;
      if (!batch || batchRef.current?.id !== batch.id) return;
      setOutcomeState(outcome ? { status: 'ready', outcome } : { status: 'unavailable' });
    },
    [queryClient],
  );

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

    const showOutcome = outcomeState.status !== 'unavailable';
    const wrongItems = showOutcome ? [] : wrong.map(toWeakResultItem);

    const actions = (
      <>
        {showContinueButton && (
          <Button
            className="w-full"
            onClick={() => {
              batchRef.current = null;
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

    const footer = (
      <>
        {outcomeState.status === 'ready' && (
          <ReviewOutcomeDetails questions={outcomeState.outcome.questions} />
        )}
        <UpcomingReviewMini days={7} />
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
        footer={footer}
      >
        {showOutcome && (
          <ReviewOutcomeSummary
            summary={outcomeState.status === 'ready' ? outcomeState.outcome.summary : null}
          />
        )}
      </QuizResultCard>
    );
  }

  // ─── Playing ──────────────────────────────────────────────────────

  return (
    <QuizRunner
      questions={questions}
      allMunicipalities={allMunicipalities}
      onAbort={() => router.replace('/')}
      onComplete={(completedResults, saveMeta) => {
        void handleComplete(completedResults, saveMeta);
      }}
    />
  );
}
