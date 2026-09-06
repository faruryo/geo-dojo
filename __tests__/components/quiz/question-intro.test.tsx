// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useQuestionIntro, type QuestionIntro } from '@/components/quiz/hud/use-question-intro';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let latest: QuestionIntro | null = null;

function Probe({ qIdx, reducedMotion }: Readonly<{ qIdx: number; reducedMotion: boolean }>) {
  latest = useQuestionIntro(qIdx, reducedMotion);
  return null;
}

let host: HTMLDivElement;
let root: Root;

function render(qIdx: number, reducedMotion: boolean) {
  act(() => {
    root.render(<Probe qIdx={qIdx} reducedMotion={reducedMotion} />);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * hold と遷移をまたいで一気に進めない。次の setTimeout は React の再描画後にしか
 * 登録されないため、1回の advance では登録前の時間が空振りする。
 */
function settle(reducedMotion: boolean) {
  advance(reducedMotion ? 2500 : 1000);
  advance(reducedMotion ? 0 : 320);
}

beforeEach(() => {
  vi.useFakeTimers();
  latest = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useQuestionIntro（通常）', () => {
  it('出題直後は導入表示から始まり、タイマーはまだ動かせない', () => {
    render(0, false);

    expect(latest?.phase).toBe('intro');
    expect(latest?.settled).toBe(false);
  });

  it('hold を過ぎると縮小移動へ、遷移を終えると定常になる', () => {
    render(0, false);

    advance(1000);
    expect(latest?.phase).toBe('settling');
    expect(latest?.settled).toBe(false);

    advance(320);
    expect(latest?.phase).toBe('steady');
    expect(latest?.settled).toBe(true);
  });

  it('問題が切り替わると導入表示に戻り、タイマーの許可も外れる', () => {
    render(0, false);
    settle(false);
    expect(latest?.settled).toBe(true);

    render(1, false);

    expect(latest?.phase).toBe('intro');
    expect(latest?.settled).toBe(false);
  });

  it('下端タップで再表示できる', () => {
    render(0, false);
    settle(false);
    expect(latest?.phase).toBe('steady');

    act(() => latest?.requestIntro());

    expect(latest?.phase).toBe('intro');
  });

  it('再表示してもタイマーの許可は外れない（読み返すたびに持ち時間が延びない）', () => {
    render(0, false);
    settle(false);
    expect(latest?.settled).toBe(true);

    act(() => latest?.requestIntro());

    expect(latest?.settled).toBe(true);
  });

  it('再表示した導入も同じ時間で定常へ戻る', () => {
    render(0, false);
    settle(false);
    act(() => latest?.requestIntro());

    settle(false);

    expect(latest?.phase).toBe('steady');
  });
});

describe('useQuestionIntro（prefers-reduced-motion）', () => {
  it('移動の遷移を挟まず、拡大表示から直接定常へ移る', () => {
    render(0, true);

    expect(latest?.phase).toBe('intro');
    expect(latest?.plan.mode).toBe('static');

    settle(true);

    expect(latest?.phase).toBe('steady');
    expect(latest?.settled).toBe(true);
  });

  it('通常の hold（1000ms）ではまだ定常にならない', () => {
    render(0, true);

    advance(1000);
    advance(320);

    expect(latest?.phase).toBe('intro');
  });
});
