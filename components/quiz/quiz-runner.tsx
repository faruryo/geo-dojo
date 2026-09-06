'use client';

import { useCallback, useMemo } from 'react';
import { representativeDifficulty, type Municipality } from '@/lib/quiz/municipality-data';
import { withKana } from '@/lib/quiz/feedback-labels';
import { sessionUsesImmersiveLayout } from '@/lib/quiz/immersive-layout';
import type { QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import { useImmersiveLayout } from '@/app/(app)/app-shell';
import {
  useQuizSession,
  type Question,
  type ModeAQuestion,
  type SingleQuestion,
} from './use-quiz-session';
import { usePopstateGuard } from '@/lib/hooks/usePopstateGuard';
import { QuizHeader } from './quiz-header';
import { QuizQuestionCard } from './quiz-question-card';
import { ChoiceView } from './views/choice-view';
import { ImmersiveQuizView } from './hud/immersive-quiz-view';

export type { Question, ModeAQuestion, SingleQuestion };

export interface QuizRunnerProps {
  readonly questions: readonly Question[];
  readonly allMunicipalities: readonly Municipality[];
  readonly onAbort: () => void;
  readonly onComplete: (results: QuizResultEntry[]) => void;
}

type QuizSession = ReturnType<typeof useQuizSession>;

/**
 * 4択だけで構成されるセッションの出題画面。
 *
 * 地図問題を1問でも含むセッションはフルスクリーン枠へ回るので、ここに来るのは
 * モード B / C のみ。県当ての分岐は存在しない。
 */
function ChoiceOnlyQuizView({
  questions,
  session,
  onAbort,
}: Readonly<{
  questions: readonly Question[];
  session: QuizSession;
  onAbort: () => void;
}>) {
  const { qIdx, currentQuestion, feedback, results, selectedChoice, handleChoice } = session;
  if (!currentQuestion || currentQuestion.kind !== 'BCD') return null;

  const { municipality, choices, mode } = currentQuestion;
  const promptText =
    mode === 'B' ? 'この市区町村はどの都道府県？' : `${municipality.prefecture}の市区町村はどれ？`;
  const feedbackDetail =
    mode === 'B'
      ? `${withKana(municipality.name, municipality.kana)} （正解: ${municipality.prefecture}）`
      : withKana(municipality.name, municipality.kana);

  return (
    <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
      <QuizHeader
        currentIndex={qIdx}
        totalQuestions={questions.length}
        correctCount={results.filter((r) => r.correct).length}
        onAbort={onAbort}
      />

      <QuizQuestionCard
        promptText={promptText}
        title={mode === 'B' ? municipality.name : municipality.prefecture}
        difficulty={representativeDifficulty([municipality])}
        feedback={feedback}
        feedbackDetail={feedbackDetail}
      />

      <ChoiceView
        choices={choices}
        selectedChoice={selectedChoice}
        correctChoice={mode === 'B' ? municipality.prefecture : municipality.name}
        feedback={feedback}
        onSelectChoice={(c) => handleChoice(c, mode === 'B' ? 'B' : 'C')}
      />
    </div>
  );
}

export function QuizRunner({
  questions,
  allMunicipalities,
  onAbort,
  onComplete,
}: Readonly<QuizRunnerProps>) {
  const session = useQuizSession({ questions, allMunicipalities, onComplete });
  const { abort } = session;

  // セッション開始時に確定する questions だけで決める。出題中に変化する値を混ぜると、
  // モード D が4択へフォールバックした瞬間にボトムナビが復帰して点滅する。
  const immersive = useMemo(() => sessionUsesImmersiveLayout(questions), [questions]);
  useImmersiveLayout(immersive);

  const handleAbort = useCallback(async () => {
    await abort();
    onAbort();
  }, [abort, onAbort]);

  usePopstateGuard(true, () => {
    void handleAbort();
  });

  if (!session.currentQuestion) return null;

  return immersive ? (
    <ImmersiveQuizView questions={questions} session={session} onAbort={handleAbort} />
  ) : (
    <ChoiceOnlyQuizView questions={questions} session={session} onAbort={handleAbort} />
  );
}
