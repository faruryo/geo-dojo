// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TIME_LIMIT_SEC, useQuizTimer } from '@/components/quiz/use-quiz-timer';
import type { Question } from '@/components/quiz/use-quiz-session';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

function modeD(name: string): Question {
  return {
    kind: 'BCD',
    mode: 'D',
    choices: [],
    municipality: {
      code: '13101',
      name,
      prefecture: '東京都',
      lat: 35,
      lng: 139,
      population: 1,
      difficulty: 'easy',
    },
  } as unknown as Question;
}

let timeLeft = -1;
let timeouts = 0;

function Probe({
  question,
  qIdx,
  armed,
}: Readonly<{ question: Question; qIdx: number; armed: boolean }>) {
  const r = useQuizTimer({
    currentQuestion: question,
    feedback: 'idle',
    modeDFailed: false,
    qIdx,
    onTimeout: () => {
      timeouts += 1;
    },
    armed,
  });
  timeLeft = r.timeLeft;
  return null;
}

let host: HTMLDivElement;
let root: Root;

function render(qIdx: number, armed: boolean) {
  act(() => {
    root.render(<Probe question={modeD(`q${qIdx}`)} qIdx={qIdx} armed={armed} />);
  });
}

function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  timeLeft = -1;
  timeouts = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useQuizTimer', () => {
  it('armed が false の間はカウントを始めない', () => {
    render(0, false);

    tick(5);

    expect(timeLeft).toBe(TIME_LIMIT_SEC);
    expect(timeouts).toBe(0);
  });

  it('armed になってから減り始める', () => {
    render(0, false);
    tick(3);
    render(0, true);

    tick(2);

    expect(timeLeft).toBe(TIME_LIMIT_SEC - 2);
  });

  it('問題が変わったら armed を待たずに満タンへ戻す', () => {
    render(0, true);
    tick(12);
    expect(timeLeft).toBe(TIME_LIMIT_SEC - 12);

    // 次の問題は導入表示中なので armed はまだ false
    render(1, false);

    expect(timeLeft).toBe(TIME_LIMIT_SEC);
  });

  it('タイムアウトで 0 になっても次の問題へは持ち越さない', () => {
    render(0, true);
    tick(TIME_LIMIT_SEC);
    expect(timeLeft).toBe(0);
    expect(timeouts).toBe(1);

    render(1, false);

    expect(timeLeft).toBe(TIME_LIMIT_SEC);
  });
});
