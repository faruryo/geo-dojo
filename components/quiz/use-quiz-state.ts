'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import { completionSeEvent, playSe } from '@/lib/quiz/sound-effects';

export type FeedbackState = 'idle' | 'correct' | 'incorrect';

export function useQuizState(
  totalQuestions: number,
  onComplete: (results: QuizResultEntry[]) => void,
) {
  const [qIdx, setQIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [results, setResults] = useState<QuizResultEntry[]>([]);
  const [modeDFailed, setModeDFailed] = useState(false);
  const [selectedPrefectures, setSelectedPrefectures] = useState<Set<string>>(new Set());
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [correctCodes, setCorrectCodes] = useState<string[]>([]);
  const [wrongCodes, setWrongCodes] = useState<string[]>([]);
  const completedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [qIdx]);

  const advanceQuestion = useCallback(
    (updatedResults: QuizResultEntry[]) => {
      setFeedback('idle');
      setSelectedPrefectures(new Set());
      setSelectedChoice(null);
      setCorrectCodes([]);
      setWrongCodes([]);
      setModeDFailed(false);
      const nextIdx = qIdx + 1;
      if (nextIdx >= totalQuestions) {
        if (!completedRef.current) {
          completedRef.current = true;
          playSe(completionSeEvent(updatedResults));
          onComplete(updatedResults);
        }
      } else {
        setQIdx(nextIdx);
      }
    },
    [qIdx, totalQuestions, onComplete],
  );

  return {
    qIdx,
    feedback,
    setFeedback,
    results,
    setResults,
    modeDFailed,
    setModeDFailed,
    selectedPrefectures,
    setSelectedPrefectures,
    selectedChoice,
    setSelectedChoice,
    correctCodes,
    setCorrectCodes,
    wrongCodes,
    setWrongCodes,
    startTimeRef,
    advanceQuestion,
  };
}
