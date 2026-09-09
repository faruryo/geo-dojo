// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  introEmphasis,
  introRestoreMs,
  questionIntroKey,
  useQuestionIntro,
  type QuestionIntro,
} from '@/components/quiz/hud/use-question-intro';

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
  // settling の長さ。移動しない設定では帯を定常へ戻す緩和の時間にあたる。
  advance(reducedMotion ? 240 : 320);
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

  it('出題外のキーから出題へ入ると導入をやり直す（都道府県クイズの初回）', () => {
    // setup 中は -1 で動き、放置すれば定常へ達している
    render(-1, false);
    settle(false);
    expect(latest?.phase).toBe('steady');

    // スタート押下で最初の問題（0）へ
    render(0, false);

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

  it('導入中の再表示要求は無視する（連打で持ち時間を先延ばしできない）', () => {
    render(0, false);

    // 定常へ到達する前に何度も要求しても hold が張り直されない
    for (let i = 0; i < 5; i++) {
      advance(400);
      act(() => latest?.requestIntro());
    }

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
  it('拡大表示のあと、緩和ぶんだけ settling を挟んで定常へ移る', () => {
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

describe('questionIntroKey', () => {
  it('出題中はその問題の番号をそのまま使う', () => {
    expect(questionIntroKey(true, 0)).toBe(0);
    expect(questionIntroKey(true, 3)).toBe(3);
  });

  it('出題外では出題中と重ならない値を返す', () => {
    const idle = questionIntroKey(false, 0);
    expect(idle).not.toBe(questionIntroKey(true, 0));
    expect(idle).toBeLessThan(0);
  });
});

describe('拡大した帯を定常へ戻す緩和', () => {
  it('拡大するのは intro の間だけで、settling では既定の寸法へ戻す', () => {
    render(0, true);
    expect(introEmphasis(latest as QuestionIntro, true)).not.toBeUndefined();

    advance(2500); // hold が明けて settling へ

    expect(latest?.phase).toBe('settling');
    // ここで拡大を残すと、steady へ移る瞬間に緩和ごと外れて一段で切り替わる。
    expect(introEmphasis(latest as QuestionIntro, true)).toBeUndefined();
  });

  it('大きくするときは即時、戻すときだけ緩やかにする', () => {
    render(0, true);

    // 大きくする側まで緩めると、再表示のたびに文字がぬるっと膨らむ。
    expect(introRestoreMs(latest as QuestionIntro, true)).toBe(0);

    advance(2500);
    expect(latest?.phase).toBe('settling');
    expect(introRestoreMs(latest as QuestionIntro, true)).toBeGreaterThan(0);

    advance(240);
    expect(latest?.phase).toBe('steady');
    expect(introRestoreMs(latest as QuestionIntro, true)).toBe(0);
  });

  it('下端タップの再表示でも大きくするのは即時', () => {
    render(0, true);
    settle(true);
    expect(latest?.phase).toBe('steady');

    act(() => latest?.requestIntro());

    expect(latest?.phase).toBe('intro');
    expect(introRestoreMs(latest as QuestionIntro, true)).toBe(0);
  });

  it('移動する設定では緩和を掛けない（定常とフィードバックの高さ差まで緩むため）', () => {
    render(0, false);

    expect(introRestoreMs(latest as QuestionIntro, true)).toBe(0);
    advance(1000);
    expect(introRestoreMs(latest as QuestionIntro, true)).toBe(0);
  });

  it('フィードバック中は緩和も拡大もしない', () => {
    render(0, true);

    expect(introRestoreMs(latest as QuestionIntro, false)).toBe(0);
    expect(introEmphasis(latest as QuestionIntro, false)).toBeUndefined();
  });
});
