'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeedbackState, Question } from './use-quiz-session';

export const TIME_LIMIT_SEC = 30;

interface UseQuizTimerProps {
  readonly currentQuestion: Question | null;
  readonly feedback: FeedbackState;
  readonly modeDFailed: boolean;
  readonly qIdx: number;
  readonly onTimeout: () => void;
}

export function useQuizTimer({
  currentQuestion,
  feedback,
  modeDFailed,
  qIdx,
  onTimeout,
}: Readonly<UseQuizTimerProps>) {
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (feedback !== 'idle' || !currentQuestion) return;
    const isTimed = currentQuestion.kind === 'BCD' && currentQuestion.mode === 'D' && !modeDFailed;
    if (!isTimed) return;

    setTimeLeft(TIME_LIMIT_SEC);
    let remaining = TIME_LIMIT_SEC;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        onTimeoutRef.current();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [feedback, qIdx, currentQuestion, modeDFailed]);

  return { timeLeft };
}
