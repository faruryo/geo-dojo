'use client';

import { useEffect, useRef, useState } from 'react';
import { playSe, stopAllSe } from '@/lib/quiz/sound-effects';
import type { FeedbackState, Question } from './use-quiz-session';

export const TIME_LIMIT_SEC = 30;
export const COUNTDOWN_HALFWAY_SEC = 15;
export const COUNTDOWN_DANGER_SEC = 6;
export const COUNTDOWN_WARNING_SEC = 5;

export type TimerSeEvent = 'halfway' | 'warning' | 'tick';

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
  /**
   * タイマー効果音トリガーのコールバック。
   * テスト時のモック注入および拡張用。未指定時は playSe が呼ばれる。
   */
  readonly onTickSe?: (event: TimerSeEvent, remaining: number) => void;
  /**
   * タイマー停止・クリーンアップ時のSE停止コールバック。
   * テスト時のモック注入用。未指定時は stopAllSe が呼ばれる。
   */
  readonly onStopSe?: () => void;
}

function notifyCountdownSe(
  remaining: number,
  onTickSe?: (event: TimerSeEvent, remaining: number) => void,
): void {
  let event: TimerSeEvent | null = null;
  if (remaining === COUNTDOWN_HALFWAY_SEC) {
    event = 'halfway';
  } else if (remaining === COUNTDOWN_DANGER_SEC) {
    event = 'warning';
  } else if (remaining <= COUNTDOWN_WARNING_SEC) {
    event = 'tick';
  }

  if (!event) return;
  if (onTickSe) {
    onTickSe(event, remaining);
  } else {
    playSe(event);
  }
}

export function useQuizTimer({
  currentQuestion,
  feedback,
  modeDFailed,
  qIdx,
  onTimeout,
  armed,
  onTickSe,
  onStopSe,
}: Readonly<UseQuizTimerProps>) {
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const onTimeoutRef = useRef(onTimeout);
  const onTickSeRef = useRef(onTickSe);
  const onStopSeRef = useRef(onStopSe);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onTickSeRef.current = onTickSe;
    onStopSeRef.current = onStopSe;
  });

  useEffect(() => {
    setTimeLeft(TIME_LIMIT_SEC);
  }, [qIdx]);

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
        notifyCountdownSe(remaining, onTickSeRef.current);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (onStopSeRef.current) {
        onStopSeRef.current();
      } else {
        stopAllSe();
      }
    };
  }, [feedback, qIdx, currentQuestion, modeDFailed, armed]);

  return { timeLeft };
}
