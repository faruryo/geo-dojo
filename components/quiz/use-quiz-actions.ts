'use client';

import { useCallback } from 'react';
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
import type { Question } from './use-quiz-session';
import type { useQuizState } from './use-quiz-state';
import { TIME_LIMIT_SEC } from './use-quiz-timer';

function findMatchingCodes(
  allMunicipalities: readonly Municipality[],
  target: Municipality,
): string[] {
  return allMunicipalities
    .filter((m) => m.name === target.name && m.prefecture === target.prefecture)
    .map((m) => m.code);
}

function isModeACorrect(
  selectedPrefectures: Set<string>,
  correctPrefectures: Set<string>,
): boolean {
  return (
    selectedPrefectures.size === correctPrefectures.size &&
    [...correctPrefectures].every((p) => selectedPrefectures.has(p))
  );
}

type QuizState = ReturnType<typeof useQuizState>;

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
  allMunicipalities: readonly Municipality[],
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[], delayMs: number) => Promise<void>,
) {
  const handleDTap = useCallback(
    async (code: string, tappedName: string) => {
      if (state.feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
      const { municipality } = currentQuestion;
      const correct = tappedName === municipality.name;
      const allCodes = findMatchingCodes(allMunicipalities, municipality);
      if (correct) state.setCorrectCodes(allCodes);
      else {
        state.setWrongCodes([code]);
        state.setCorrectCodes(allCodes);
      }
      state.setFeedback(correct ? 'correct' : 'incorrect');
      playSe(correct ? 'correct' : 'incorrect');
      await recordAndAdvance(
        [{ municipality, isCorrect: correct, mode: 'D', answerTimeMs: elapsedMs }],
        1500,
      );
    },
    [state, currentQuestion, allMunicipalities, recordAndAdvance],
  );

  const handleTimeout = useCallback(async () => {
    if (state.feedback !== 'idle' || !currentQuestion) return;
    if (currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !state.modeDFailed) {
      const { municipality } = currentQuestion;
      state.setCorrectCodes(findMatchingCodes(allMunicipalities, municipality));
      state.setFeedback('incorrect');
      playSe('incorrect');
      await recordAndAdvance([createTimeoutEntry(municipality, TIME_LIMIT_SEC)], 1500);
    }
  }, [state, currentQuestion, allMunicipalities, recordAndAdvance]);

  return { handleDTap, handleTimeout };
}

interface UseQuizActionsProps {
  readonly currentQuestion: Question | null;
  readonly allMunicipalities: readonly Municipality[];
  readonly state: QuizState;
}

export function useQuizActions({
  currentQuestion,
  allMunicipalities,
  state,
}: Readonly<UseQuizActionsProps>) {
  const recordAndAdvance = useCallback(
    async (entries: QuizSessionEntry[], delayMs: number) => {
      const updated = await executeQuizAdvance(entries, state.results, saveMunicipalityQuizResult);
      state.setResults(updated);
      setTimeout(() => state.advanceQuestion(updated), delayMs);
    },
    [state],
  );

  const handleModeASubmit = useModeAAction(currentQuestion, state, recordAndAdvance);
  const handleChoice = useChoiceAction(currentQuestion, state, recordAndAdvance);
  const { handleDTap, handleTimeout } = useMapAction(
    currentQuestion,
    allMunicipalities,
    state,
    recordAndAdvance,
  );

  return { handleModeASubmit, handleChoice, handleDTap, handleTimeout };
}
