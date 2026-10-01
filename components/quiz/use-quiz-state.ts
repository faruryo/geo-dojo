'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import { completionSeEvent, playSe } from '@/lib/quiz/sound-effects';
import { calculateStreak } from '@/lib/quiz/streak';

export type FeedbackState = 'idle' | 'correct' | 'incorrect';

export type QuizCompleteHandler = (
  results: QuizResultEntry[],
  saveMeta?: readonly QuestionSaveMeta[],
) => void;

function useSelectionState() {
  const [selectedPrefectures, setSelectedPrefectures] = useState<Set<string>>(new Set());
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [correctCodes, setCorrectCodes] = useState<string[]>([]);
  const [wrongCodes, setWrongCodes] = useState<string[]>([]);

  const resetSelection = useCallback(() => {
    setSelectedPrefectures(new Set());
    setSelectedChoice(null);
    setCorrectCodes([]);
    setWrongCodes([]);
  }, []);

  return {
    selectedPrefectures,
    setSelectedPrefectures,
    selectedChoice,
    setSelectedChoice,
    correctCodes,
    setCorrectCodes,
    wrongCodes,
    setWrongCodes,
    resetSelection,
  };
}

export function useQuizState(
  totalQuestions: number,
  onComplete: QuizCompleteHandler,
) {
  const [qIdx, setQIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [results, setResults] = useState<QuizResultEntry[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [modeDFailed, setModeDFailed] = useState(false);
  const selection = useSelectionState();
  const completedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [qIdx]);

  const advanceQuestion = useCallback(
    (updatedResults: QuizResultEntry[], saveMeta?: readonly QuestionSaveMeta[]) => {
      setFeedback('idle');
      setCurrentStreak(calculateStreak(updatedResults));
      selection.resetSelection();
      setModeDFailed(false);
      const nextIdx = qIdx + 1;
      if (nextIdx >= totalQuestions) {
        if (!completedRef.current) {
          completedRef.current = true;
          playSe(completionSeEvent(updatedResults));
          onComplete(updatedResults, saveMeta);
        }
      } else {
        setQIdx(nextIdx);
      }
    },
    [qIdx, totalQuestions, onComplete, selection],
  );

  return {
    qIdx,
    feedback,
    setFeedback,
    results,
    setResults,
    currentStreak,
    setCurrentStreak,
    modeDFailed,
    setModeDFailed,
    ...selection,
    startTimeRef,
    advanceQuestion,
  };
}
