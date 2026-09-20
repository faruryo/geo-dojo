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
    state.setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) {
      playCorrectSe({ streak: calculateStreak(state.results) + 1 });
    } else {
      playSe('incorrect');
    }
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
      state.setFeedback(correct ? 'correct' : 'incorrect');
      if (correct) {
        playCorrectSe({ streak: calculateStreak(state.results) + 1 });
      } else {
        playSe('incorrect');
      }
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
      state.setFeedback(correct ? 'correct' : 'incorrect');
      if (correct) {
        playCorrectSe({ streak: calculateStreak(state.results) + 1 });
      } else {
        playSe('incorrect');
      }
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

export function useQuizActions({
  currentQuestion,
  allMunicipalities: _allMunicipalities,
  state,
}: Readonly<UseQuizActionsProps>) {
  const inFlightSavesRef = useRef<Set<Promise<unknown>>>(new Set());
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAbortedRef = useRef<boolean>(false);
  const skipRequestedRef = useRef<boolean>(false);
  const guardUntilRef = useRef<number>(0);
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
    [state],
  );

  const handleSkip = useCallback(() => {
    if (state.feedback === 'idle') return;
    if (inFlightSavesRef.current.size > 0) {
      // 保存処理が進行中の場合、保留 (FR-004b)
      skipRequestedRef.current = true;
      return;
    }
    // 保存が既に完了している場合、即時遷移 (FR-004a, SC-004)
    triggerAdvance(latestResultsRef.current);
  }, [state.feedback, triggerAdvance]);

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
    async (entries: QuizSessionEntry[]) => {
      skipRequestedRef.current = false;
      const savePromise = executeQuizAdvance(entries, state.results, saveMunicipalityQuizResults);
      inFlightSavesRef.current.add(savePromise);
      void savePromise.finally(() => {
        inFlightSavesRef.current.delete(savePromise);
      });

      const { results: updated, persisted } = await savePromise;
      if (persisted) await appendDisplayQuestion(entries);
      if (isAbortedRef.current) return;

      latestResultsRef.current = updated;
      state.setResults(updated);

      if (skipRequestedRef.current) {
        // 保存中にスキップ要求があった場合、保存完了と同時に遅延ゼロで即遷移 (FR-004b)
        triggerAdvance(updated);
        return;
      }

      // スキップがなければ一律 2.0秒 (2,000ms) の待機時間を経て自動遷移 (FR-004e)
      advanceTimerRef.current = setTimeout(() => {
        triggerAdvance(updated);
      }, FEEDBACK_ADVANCE_DELAY_MS);
    },
    [state, triggerAdvance],
  );

  // キーボード (Space / Enter) によるフィードバック中スキップ (FR-004a, FR-004c)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (state.feedback === 'idle') return;
      if (event.repeat) return; // FR-004c: キーリピート抑止

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key === ' ' || event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        handleSkip();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.feedback, handleSkip]);

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

  return {
    handleModeASubmit,
    handleChoice,
    handleDTap,
    handleTimeout,
    handleSkip,
    awaitPendingSaves,
    abort,
  };
}
