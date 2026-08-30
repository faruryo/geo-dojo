'use client';

import { useCallback, useRef } from 'react';
import { saveMunicipalityQuizResult } from '@/app/(app)/quiz/municipality/actions';
import {
  dedupeInstancesByPrefecture,
  type Municipality,
} from '@/lib/quiz/municipality-data';
import {
  executeQuizAdvance,
  createTimeoutEntry,
  type QuizSessionEntry,
} from '@/lib/quiz/quiz-session-core';
import { playSe } from '@/lib/quiz/sound-effects';
import { isModeDTapCorrect } from '@/lib/quiz/mode-d-judge';
import { toQuestionResult } from '@/lib/quiz/quiz-results';
import { appendRecommendQuestion } from '@/lib/quiz/recommendation/history-cache';
import type { Question } from './use-quiz-session';
import type { useQuizState } from './use-quiz-state';
import { TIME_LIMIT_SEC } from './use-quiz-timer';

type QuizState = ReturnType<typeof useQuizState>;

function isModeACorrect(
  selectedPrefectures: Set<string>,
  correctPrefectures: Set<string>,
): boolean {
  return (
    selectedPrefectures.size === correctPrefectures.size &&
    [...correctPrefectures].every((p) => selectedPrefectures.has(p))
  );
}

export function useModeAAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[], delayMs: number) => Promise<void>,
) {
  return useCallback(async () => {
    if (!currentQuestion || currentQuestion.kind !== 'A') return;
    const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
    const correct = isModeACorrect(state.selectedPrefectures, currentQuestion.correctPrefectures);
    state.setFeedback(correct ? 'correct' : 'incorrect');
    playSe(correct ? 'correct' : 'incorrect');
    const reps = dedupeInstancesByPrefecture(currentQuestion.instances);
    await recordAndAdvance(
      reps.map((m) => ({ municipality: m, isCorrect: correct, mode: 'A', answerTimeMs: elapsedMs })),
      1500,
    );
  }, [currentQuestion, state, recordAndAdvance]);
}

export function useChoiceAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[], delayMs: number) => Promise<void>,
) {
  return useCallback(
    async (choice: string, mode: 'B' | 'C') => {
      if (state.feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
      const { municipality } = currentQuestion;
      const correct = mode === 'B' ? choice === municipality.prefecture : choice === municipality.name;
      state.setSelectedChoice(choice);
      state.setFeedback(correct ? 'correct' : 'incorrect');
      playSe(correct ? 'correct' : 'incorrect');
      await recordAndAdvance(
        [{ municipality, isCorrect: correct, mode, answerTimeMs: elapsedMs }],
        1200,
      );
    },
    [state, currentQuestion, recordAndAdvance],
  );
}

export function useMapAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[], delayMs: number) => Promise<void>,
) {
  const handleDTap = useCallback(
    async (code: string) => {
      if (state.feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
      const { municipality } = currentQuestion;
      const correct = isModeDTapCorrect(code, municipality.code);
      const highlight = [municipality.code];
      if (correct) state.setCorrectCodes(highlight);
      else {
        state.setWrongCodes([code]);
        state.setCorrectCodes(highlight);
      }
      state.setFeedback(correct ? 'correct' : 'incorrect');
      playSe(correct ? 'correct' : 'incorrect');
      await recordAndAdvance(
        [{ municipality, isCorrect: correct, mode: 'D', answerTimeMs: elapsedMs }],
        1500,
      );
    },
    [state, currentQuestion, recordAndAdvance],
  );

  const handleTimeout = useCallback(async () => {
    if (state.feedback !== 'idle' || !currentQuestion) return;
    if (currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !state.modeDFailed) {
      const { municipality } = currentQuestion;
      state.setCorrectCodes([municipality.code]);
      state.setFeedback('incorrect');
      playSe('incorrect');
      await recordAndAdvance([createTimeoutEntry(municipality, TIME_LIMIT_SEC)], 1500);
    }
  }, [state, currentQuestion, recordAndAdvance]);

  return { handleDTap, handleTimeout };
}

interface UseQuizActionsProps {
  readonly currentQuestion: Question | null;
  readonly allMunicipalities: readonly Municipality[];
  readonly state: QuizState;
}

function appendDisplayQuestion(entries: QuizSessionEntry[]): void {
  const head = entries[0];
  if (!head) return;
  const display = toQuestionResult(entries);
  appendRecommendQuestion({
    mode: head.mode,
    correct: display.correct,
    region: head.municipality.region,
    difficulty: head.municipality.difficulty ?? 'easy',
  });
}

export function useQuizActions({
  currentQuestion,
  allMunicipalities: _allMunicipalities,
  state,
}: Readonly<UseQuizActionsProps>) {
  const inFlightSavesRef = useRef<Set<Promise<unknown>>>(new Set());
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAbortedRef = useRef<boolean>(false);

  const awaitPendingSaves = useCallback(async () => {
    if (inFlightSavesRef.current.size > 0) {
      await Promise.allSettled(Array.from(inFlightSavesRef.current));
    }
  }, []);

  const abort = useCallback(async () => {
    isAbortedRef.current = true;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    await awaitPendingSaves();
  }, [awaitPendingSaves]);

  const recordAndAdvance = useCallback(
    async (entries: QuizSessionEntry[], delayMs: number) => {
      const savePromise = executeQuizAdvance(entries, state.results, saveMunicipalityQuizResult);
      inFlightSavesRef.current.add(savePromise);
      void savePromise.finally(() => {
        inFlightSavesRef.current.delete(savePromise);
      });

      const { results: updated, persisted } = await savePromise;
      if (persisted) appendDisplayQuestion(entries);
      if (isAbortedRef.current) return;

      state.setResults(updated);
      advanceTimerRef.current = setTimeout(() => {
        if (!isAbortedRef.current) {
          state.advanceQuestion(updated);
        }
      }, delayMs);
    },
    [state],
  );

  const handleModeASubmit = useModeAAction(currentQuestion, state, recordAndAdvance);
  const handleChoice = useChoiceAction(currentQuestion, state, recordAndAdvance);
  const { handleDTap, handleTimeout } = useMapAction(
    currentQuestion,
    state,
    recordAndAdvance,
  );

  return {
    handleModeASubmit,
    handleChoice,
    handleDTap,
    handleTimeout,
    awaitPendingSaves,
    abort,
  };
}
