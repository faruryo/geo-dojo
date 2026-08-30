'use client';

import { useCallback } from 'react';
import { representativeDifficulty, type Municipality } from '@/lib/quiz/municipality-data';
import { locationLabel } from '@/lib/quiz/location-labels';
import { formatModeAFeedback, withKana } from '@/lib/quiz/feedback-labels';
import type { QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import {
  useQuizSession,
  TIME_LIMIT_SEC,
  type Question,
  type ModeAQuestion,
  type SingleQuestion,
} from './use-quiz-session';
import { usePopstateGuard } from '@/lib/hooks/usePopstateGuard';
import { QuizHeader } from './quiz-header';
import { QuizQuestionCard } from './quiz-question-card';
import { ModeAView } from './views/mode-a-view';
import { ChoiceView } from './views/choice-view';
import { MunicipalityMapView } from './views/municipality-map-view';

export type { Question, ModeAQuestion, SingleQuestion };

export interface QuizRunnerProps {
  readonly questions: readonly Question[];
  readonly allMunicipalities: readonly Municipality[];
  readonly onAbort: () => void;
  readonly onComplete: (results: QuizResultEntry[]) => void;
}

export function QuizRunner({
  questions,
  allMunicipalities,
  onAbort,
  onComplete,
}: Readonly<QuizRunnerProps>) {
  const {
    qIdx,
    currentQuestion,
    feedback,
    results,
    modeDFailed,
    selectedPrefectures,
    selectedChoice,
    correctCodes,
    wrongCodes,
    timeLeft,
    handlePrefectureTap,
    handleModeASubmit,
    handleChoice,
    handleDTap,
    handleModeDFallback,
    abort,
  } = useQuizSession({ questions, allMunicipalities, onComplete });

  const handleAbort = useCallback(async () => {
    await abort();
    onAbort();
  }, [abort, onAbort]);

  usePopstateGuard(true, () => {
    void handleAbort();
  });

  if (!currentQuestion) return null;

  const correctCount = results.filter((r) => r.correct).length;
  const currentDifficulty =
    currentQuestion.kind === 'A'
      ? representativeDifficulty(currentQuestion.instances)
      : representativeDifficulty([currentQuestion.municipality]);

  // ── Mode A View ──
  if (currentQuestion.kind === 'A') {
    const { name, instances, correctPrefectures } = currentQuestion;
    const remaining = correctPrefectures.size - selectedPrefectures.size;
    const feedbackLabel = formatModeAFeedback(name, instances);

    return (
      <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
        <QuizHeader
          currentIndex={qIdx}
          totalQuestions={questions.length}
          correctCount={correctCount}
          onAbort={handleAbort}
        />

        <QuizQuestionCard
          promptText="この市区町村がある都道府県を地図でタップ"
          title={name}
          subTitle={
            correctPrefectures.size > 1
              ? `${correctPrefectures.size} か所あります`
              : undefined
          }
          extraPrompt={
            feedback === 'idle' &&
            correctPrefectures.size > 1 &&
            selectedPrefectures.size < correctPrefectures.size ? (
              <p className="text-xs text-yellow-500 mt-1">あと {remaining} か所</p>
            ) : undefined
          }
          difficulty={currentDifficulty}
          feedback={feedback}
          feedbackDetail={feedbackLabel}
        />

        <ModeAView
          qIdx={qIdx}
          correctPrefectures={correctPrefectures}
          selectedPrefectures={selectedPrefectures}
          feedback={feedback}
          onPrefectureTap={handlePrefectureTap}
          onSubmit={handleModeASubmit}
        />
      </div>
    );
  }

  // ── Mode B / C / D View ──
  const { municipality, choices, mode } = currentQuestion;
  const effectiveMode = mode === 'D' && modeDFailed ? 'C' : mode;

  const promptText =
    mode === 'B'
      ? 'この市区町村はどの都道府県？'
      : effectiveMode === 'D'
        ? 'この市区町村を地図でタップ'
        : `${municipality.prefecture}の市区町村はどれ？`;

  const displayName =
    mode === 'D' ? locationLabel(municipality.code, municipality.name) : municipality.name;

  const title =
    mode === 'B' || effectiveMode === 'D'
      ? displayName
      : municipality.prefecture;

  const subTitle = effectiveMode === 'D' ? `（${municipality.prefecture}）` : undefined;

  const feedbackDetail =
    mode === 'B'
      ? `${withKana(municipality.name, municipality.kana)} （正解: ${municipality.prefecture}）`
      : withKana(displayName, municipality.kana);

  const correctChoice = mode === 'B' ? municipality.prefecture : municipality.name;

  return (
    <div className="flex flex-col h-full gap-2 p-3 max-w-4xl mx-auto">
      <QuizHeader
        currentIndex={qIdx}
        totalQuestions={questions.length}
        correctCount={correctCount}
        onAbort={handleAbort}
      />

      {effectiveMode === 'D' && (
        <div className="shrink-0 space-y-0.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${(timeLeft / TIME_LIMIT_SEC) * 100}%`,
                backgroundColor:
                  timeLeft > 8 ? '#22c55e' : timeLeft > 4 ? '#eab308' : '#ef4444',
              }}
            />
          </div>
          <p className="text-[10px] text-right text-muted-foreground">
            残り {timeLeft} 秒
          </p>
        </div>
      )}

      <QuizQuestionCard
        promptText={promptText}
        title={title}
        subTitle={subTitle}
        difficulty={currentDifficulty}
        feedback={feedback}
        feedbackDetail={feedbackDetail}
      />

      {modeDFailed && (
        <p className="text-center text-xs text-muted-foreground shrink-0">
          地図データの読み込みに失敗しました（モードCで代替表示）
        </p>
      )}

      {effectiveMode === 'D' ? (
        <MunicipalityMapView
          prefecture={municipality.prefecture}
          qIdx={qIdx}
          correctCodes={correctCodes}
          wrongCodes={wrongCodes}
          feedback={feedback}
          onMunicipalityClick={handleDTap}
          onLoadError={handleModeDFallback}
        />
      ) : (
        <ChoiceView
          choices={choices}
          selectedChoice={selectedChoice}
          correctChoice={correctChoice}
          feedback={feedback}
          onSelectChoice={(c) => handleChoice(c, mode === 'B' ? 'B' : 'C')}
        />
      )}
    </div>
  );
}
