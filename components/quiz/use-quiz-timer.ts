'use client';

import { useEffect, useRef, useState } from 'react';
import { playSe } from '@/lib/quiz/sound-effects';
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
}

export function useQuizTimer({
  currentQuestion,
  feedback,
  modeDFailed,
  qIdx,
  onTimeout,
  armed,
  onTickSe,
}: Readonly<UseQuizTimerProps>) {
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const onTimeoutRef = useRef(onTimeout);
  const onTickSeRef = useRef(onTickSe);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onTickSeRef.current = onTickSe;
  });

  // 問題が変わったら armed を待たずに戻す。armed が立つまでの導入表示のあいだ、
  // 前問の残秒数（タイムアウトなら 0）が出たままになり、開始と同時に跳ね上がる。
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
        const triggerSe = (event: TimerSeEvent) => {
          if (onTickSeRef.current) {
            onTickSeRef.current(event, remaining);
          } else {
            playSe(event);
          }
        };

        if (remaining === COUNTDOWN_HALFWAY_SEC) {
          triggerSe('halfway');
        } else if (remaining === COUNTDOWN_DANGER_SEC) {
          triggerSe('warning');
        } else if (remaining <= COUNTDOWN_WARNING_SEC) {
          triggerSe('tick');
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [feedback, qIdx, currentQuestion, modeDFailed, armed]);

  return { timeLeft };
}
