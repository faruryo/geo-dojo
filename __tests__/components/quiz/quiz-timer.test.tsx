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
let seEvents: { event: string; remaining: number }[] = [];

function Probe({
  question,
  qIdx,
  armed,
  feedback = 'idle',
}: Readonly<{ question: Question; qIdx: number; armed: boolean; feedback?: 'idle' | 'correct' | 'incorrect' }>) {
  const r = useQuizTimer({
    currentQuestion: question,
    feedback,
    modeDFailed: false,
    qIdx,
    onTimeout: () => {
      timeouts += 1;
    },
    onTickSe: (event, remaining) => {
      seEvents.push({ event, remaining });
    },
    armed,
  });
  timeLeft = r.timeLeft;
  return null;
}

let host: HTMLDivElement;
let root: Root;

function render(qIdx: number, armed: boolean, feedback: 'idle' | 'correct' | 'incorrect' = 'idle') {
  act(() => {
    root.render(<Probe question={modeD(`q${qIdx}`)} qIdx={qIdx} armed={armed} feedback={feedback} />);
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
  seEvents = [];
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

  it('残り15秒（半分）到達時に halfway 音が発火する', () => {
    render(0, true);
    tick(14);
    expect(seEvents).toEqual([]);

    tick(1); // 15秒経過（残り15秒）
    expect(timeLeft).toBe(15);
    expect(seEvents).toEqual([{ event: 'halfway', remaining: 15 }]);
  });

  it('残り6秒（危険ゾーン突入）で warning 音、5〜1秒で tick 音が発火する', () => {
    render(0, true);
    tick(24); // 残り6秒
    expect(timeLeft).toBe(6);
    expect(seEvents).toEqual([
      { event: 'halfway', remaining: 15 },
      { event: 'warning', remaining: 6 },
    ]);

    tick(5); // 残り1秒まで
    expect(timeLeft).toBe(1);
    expect(seEvents).toEqual([
      { event: 'halfway', remaining: 15 },
      { event: 'warning', remaining: 6 },
      { event: 'tick', remaining: 5 },
      { event: 'tick', remaining: 4 },
      { event: 'tick', remaining: 3 },
      { event: 'tick', remaining: 2 },
      { event: 'tick', remaining: 1 },
    ]);

    // 0秒（タイムアウト）
    tick(1);
    expect(timeLeft).toBe(0);
    expect(timeouts).toBe(1);
    // 0秒では tick は追加されない（タイムアウト処理へ委譲）
    expect(seEvents).toHaveLength(7);
  });

  it('途中で回答（feedback変化）した場合は以降のSEが鳴らない', () => {
    render(0, true, 'idle');
    tick(24); // 残り6秒まで進行
    expect(seEvents).toEqual([
      { event: 'halfway', remaining: 15 },
      { event: 'warning', remaining: 6 },
    ]);

    // 回答完了で feedback が変化
    render(0, true, 'correct');
    tick(5);

    // 追加の tick は発火しない
    expect(seEvents).toEqual([
      { event: 'halfway', remaining: 15 },
      { event: 'warning', remaining: 6 },
    ]);
  });
});
