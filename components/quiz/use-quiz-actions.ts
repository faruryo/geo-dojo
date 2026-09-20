'use client';

import { useCallback, useEffect, useRef } from 'react';
import { saveMunicipalityQuizResults } from '@/app/(app)/quiz/municipality/actions';
import {
  dedupeInstancesByPrefecture,
  type Municipality,
} from '@/lib/quiz/municipality-data';
import {
  executeQuizAdvance,
  createTimeoutEntry,
  type QuizSessionEntry,
  type QuizResultEntry,
} from '@/lib/quiz/quiz-session-core';
import { isAudioContextRunning, playCorrectSe, playSe } from '@/lib/quiz/sound-effects';
import { isModeDTapCorrect } from '@/lib/quiz/mode-d-judge';
import { toQuestionResult } from '@/lib/quiz/quiz-results';
import { calculateStreak } from '@/lib/quiz/streak';
import { appendRecommendQuestion, readActiveRecommendUserId } from '@/lib/quiz/recommendation/history-cache';
import { useFeedbackKeyboardSkip } from './hud/use-feedback-keyboard-skip';
import type { Question } from './use-quiz-session';
import type { useQuizState } from './use-quiz-state';
import { TIME_LIMIT_SEC } from './use-quiz-timer';

type QuizState = ReturnType<typeof useQuizState>;

export const FEEDBACK_ADVANCE_DELAY_MS = 2000;
export const TAP_GUARD_MS = 250;

function isModeACorrect(
  selectedPrefectures: Set<string>,
  correctPrefectures: Set<string>,
): boolean {
  return (
    selectedPrefectures.size === correctPrefectures.size &&
    [...correctPrefectures].every((p) => selectedPrefectures.has(p))
  );
}

function applyAnswerFeedback(
  correct: boolean,
  state: QuizState,
) {
  state.setFeedback(correct ? 'correct' : 'incorrect');
  if (correct) {
    const nextStreak = calculateStreak(state.results) + 1;
    state.setCurrentStreak(nextStreak);
    playCorrectSe({ streak: nextStreak });
  } else {
    state.setCurrentStreak(0);
    playSe('incorrect');
  }
}

export function useModeAAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[]) => Promise<void>,
  guardUntilRef: React.RefObject<number>,
) {
  return useCallback(async () => {
    if (Date.now() < guardUntilRef.current) return;
    if (!currentQuestion || currentQuestion.kind !== 'A' || state.feedback !== 'idle') return;
    const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
    const correct = isModeACorrect(state.selectedPrefectures, currentQuestion.correctPrefectures);
    applyAnswerFeedback(correct, state);
    const reps = dedupeInstancesByPrefecture(currentQuestion.instances);
    await recordAndAdvance(
      reps.map((m) => ({ municipality: m, isCorrect: correct, mode: 'A', answerTimeMs: elapsedMs })),
    );
  }, [currentQuestion, state, recordAndAdvance, guardUntilRef]);
}

export function useChoiceAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[]) => Promise<void>,
  guardUntilRef: React.RefObject<number>,
) {
  return useCallback(
    async (choice: string, mode: 'B' | 'C') => {
      if (Date.now() < guardUntilRef.current) return;
      if (state.feedback !== 'idle' || !currentQuestion || currentQuestion.kind !== 'BCD') return;
      const elapsedMs = Math.max(0, Date.now() - state.startTimeRef.current);
      const { municipality } = currentQuestion;
      const correct = mode === 'B' ? choice === municipality.prefecture : choice === municipality.name;
      state.setSelectedChoice(choice);
      applyAnswerFeedback(correct, state);
      await recordAndAdvance([
        { municipality, isCorrect: correct, mode, answerTimeMs: elapsedMs },
      ]);
    },
    [state, currentQuestion, recordAndAdvance, guardUntilRef],
  );
}

export function useMapAction(
  currentQuestion: Question | null,
  state: QuizState,
  recordAndAdvance: (entries: QuizSessionEntry[]) => Promise<void>,
  guardUntilRef: React.RefObject<number>,
) {
  const handleDTap = useCallback(
    async (code: string) => {
      if (Date.now() < guardUntilRef.current) return;
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
      applyAnswerFeedback(correct, state);
      await recordAndAdvance([
        { municipality, isCorrect: correct, mode: 'D', answerTimeMs: elapsedMs },
      ]);
    },
    [state, currentQuestion, recordAndAdvance, guardUntilRef],
  );

  const handleTimeout = useCallback(async () => {
    if (state.feedback !== 'idle' || !currentQuestion) return;
    if (currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !state.modeDFailed) {
      const { municipality } = currentQuestion;
      state.setCorrectCodes([municipality.code]);
      state.setCurrentStreak(0);
      state.setFeedback('incorrect');
      if (isAudioContextRunning()) {
        playSe('incorrect');
      }
      await recordAndAdvance([createTimeoutEntry(municipality, TIME_LIMIT_SEC)]);
    }
  }, [state, currentQuestion, recordAndAdvance]);

  return { handleDTap, handleTimeout };
}

interface UseQuizActionsProps {
  readonly currentQuestion: Question | null;
  readonly allMunicipalities: readonly Municipality[];
  readonly state: QuizState;
}

async function appendDisplayQuestion(entries: QuizSessionEntry[]): Promise<void> {
  const head = entries[0];
  if (!head) return;
  const display = toQuestionResult(entries);
  const userId = readActiveRecommendUserId();
  appendRecommendQuestion(userId, {
    mode: head.mode,
    correct: display.correct,
    region: head.municipality.region,
    difficulty: head.municipality.difficulty ?? 'easy',
  });
}


function useInFlightSaves() {
  const inFlightSavesRef = useRef<Set<Promise<unknown>>>(new Set());

  const trackSave = useCallback((promise: Promise<unknown>) => {
    inFlightSavesRef.current.add(promise);
    void promise.finally(() => {
      inFlightSavesRef.current.delete(promise);
    });
  }, []);

  const awaitPendingSaves = useCallback(async () => {
    if (inFlightSavesRef.current.size > 0) {
      await Promise.allSettled(Array.from(inFlightSavesRef.current));
    }
  }, []);

  const hasInFlight = useCallback(() => inFlightSavesRef.current.size > 0, []);

  return { trackSave, awaitPendingSaves, hasInFlight };
}

function useAdvanceCoordinator(state: QuizState, guardUntilRef: React.RefObject<number>) {
  const { trackSave, awaitPendingSaves, hasInFlight } = useInFlightSaves();
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAbortedRef = useRef<boolean>(false);
  const skipRequestedRef = useRef<boolean>(false);
  const latestResultsRef = useRef<QuizResultEntry[]>(state.results);

  useEffect(() => {
    latestResultsRef.current = state.results;
  }, [state.results]);

  const triggerAdvance = useCallback(
    (resultsToAdvance: QuizResultEntry[]) => {
      if (isAbortedRef.current) return;
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      skipRequestedRef.current = false;
      guardUntilRef.current = Date.now() + TAP_GUARD_MS;
      state.advanceQuestion(resultsToAdvance);
    },
    [state, guardUntilRef],
  );

  const handleSkip = useCallback(() => {
    if (state.feedback === 'idle') return;
    if (hasInFlight()) {
      skipRequestedRef.current = true;
      return;
    }
    triggerAdvance(latestResultsRef.current);
  }, [state.feedback, hasInFlight, triggerAdvance]);

  const abort = useCallback(async () => {
    isAbortedRef.current = true;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    await awaitPendingSaves();
  }, [awaitPendingSaves]);

  const recordAndAdvance = useCallback(
    async (entries: QuizSessionEntry[]) => {
      skipRequestedRef.current = false;
      const savePromise = executeQuizAdvance(entries, state.results, saveMunicipalityQuizResults);
      trackSave(savePromise);

      const { results: updated, persisted } = await savePromise;
      if (persisted) await appendDisplayQuestion(entries);
      if (isAbortedRef.current) return;

      latestResultsRef.current = updated;
      state.setResults(updated);

      if (skipRequestedRef.current) {
        triggerAdvance(updated);
        return;
      }

      advanceTimerRef.current = setTimeout(() => {
        triggerAdvance(updated);
      }, FEEDBACK_ADVANCE_DELAY_MS);
    },
    [state, trackSave, triggerAdvance],
  );

  return { handleSkip, recordAndAdvance, awaitPendingSaves, abort };
}

export function useQuizActions({
  currentQuestion,
  allMunicipalities: _allMunicipalities,
  state,
}: Readonly<UseQuizActionsProps>) {
  const guardUntilRef = useRef<number>(0);
  const { handleSkip, recordAndAdvance, awaitPendingSaves, abort } = useAdvanceCoordinator(
    state,
    guardUntilRef,
  );

  useFeedbackKeyboardSkip(state.feedback !== 'idle', handleSkip);

  const handleModeASubmit = useModeAAction(
    currentQuestion,
    state,
    recordAndAdvance,
    guardUntilRef,
  );
  const handleChoice = useChoiceAction(
    currentQuestion,
    state,
    recordAndAdvance,
    guardUntilRef,
  );
  const { handleDTap, handleTimeout } = useMapAction(
    currentQuestion,
    state,
    recordAndAdvance,
    guardUntilRef,
  );

  const isTapGuarded = useCallback(() => Date.now() < guardUntilRef.current, []);

  return {
    handleModeASubmit,
    handleChoice,
    handleDTap,
    handleTimeout,
    handleSkip,
    isTapGuarded,
    awaitPendingSaves,
    abort,
  };
}
