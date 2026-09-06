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
  /**
   * 導入表示が終わるまで false。お題を読んでいる間に持ち時間が減らないようにする。
   * 影響するのはこの制限時間だけで、解答時間（SRS 用）の起点には関与しない。
   */
  readonly armed: boolean;
}

export function useQuizTimer({
  currentQuestion,
  feedback,
  modeDFailed,
  qIdx,
  onTimeout,
  armed,
}: Readonly<UseQuizTimerProps>) {
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (feedback !== 'idle' || !currentQuestion || !armed) return;
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
  }, [feedback, qIdx, currentQuestion, modeDFailed, armed]);

  return { timeLeft };
}
