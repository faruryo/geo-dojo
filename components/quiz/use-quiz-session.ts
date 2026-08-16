'use client';

import { useCallback } from 'react';
import type { Municipality } from '@/lib/quiz/municipality-data';
import type { QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import { useQuizState, type FeedbackState } from './use-quiz-state';
import { useQuizTimer, TIME_LIMIT_SEC } from './use-quiz-timer';
import { useQuizActions } from './use-quiz-actions';

export { TIME_LIMIT_SEC };
export type { FeedbackState };

export interface ModeAQuestion {
  kind: 'A';
  name: string;
  instances: Municipality[];
  correctPrefectures: Set<string>;
}

export interface SingleQuestion {
  kind: 'BCD';
  mode: 'B' | 'C' | 'D';
  municipality: Municipality;
  choices: string[];
}

export type Question = ModeAQuestion | SingleQuestion;

export interface UseQuizSessionProps {
  readonly questions: readonly Question[];
  readonly allMunicipalities: readonly Municipality[];
  readonly onComplete: (results: QuizResultEntry[]) => void;
}

export function useQuizSession({
  questions,
  allMunicipalities,
  onComplete,
}: Readonly<UseQuizSessionProps>) {
  const state = useQuizState(questions.length, onComplete);
  const currentQuestion =
    state.qIdx < questions.length ? questions.at(state.qIdx) ?? null : null;

  const { handleModeASubmit, handleChoice, handleDTap, handleTimeout } = useQuizActions({
    currentQuestion,
    allMunicipalities,
    state,
  });

  const handlePrefectureTap = useCallback(
    (name: string) => {
      if (state.feedback !== 'idle') return;
      state.setSelectedPrefectures((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    },
    [state],
  );

  const handleModeDFallback = useCallback(() => state.setModeDFailed(true), [state]);

  const { timeLeft } = useQuizTimer({
    currentQuestion,
    feedback: state.feedback,
    modeDFailed: state.modeDFailed,
    qIdx: state.qIdx,
    onTimeout: () => {
      void handleTimeout();
    },
  });

  return {
    qIdx: state.qIdx,
    currentQuestion,
    feedback: state.feedback,
    results: state.results,
    modeDFailed: state.modeDFailed,
    selectedPrefectures: state.selectedPrefectures,
    selectedChoice: state.selectedChoice,
    correctCodes: state.correctCodes,
    wrongCodes: state.wrongCodes,
    timeLeft,
    handlePrefectureTap,
    handleModeASubmit,
    handleChoice,
    handleDTap,
    handleModeDFallback,
  };
}
