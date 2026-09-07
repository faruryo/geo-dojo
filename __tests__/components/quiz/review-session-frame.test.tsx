// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ImmersiveQuizView } from '@/components/quiz/hud/immersive-quiz-view';
import type { ModeAQuestion, Question, SingleQuestion } from '@/components/quiz/use-quiz-session';
import type { Municipality } from '@/lib/quiz/municipality-data';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

// 地図そのものはこのテストの関心事ではない。枠の構成が問題の種類で変わらないことだけを見る。
vi.mock('@/components/quiz/views/mode-a-view', () => ({
  ModeAView: () => <div data-testid="stage-map-a" />,
}));
vi.mock('@/components/quiz/views/municipality-map-view', () => ({
  MunicipalityMapView: () => <div data-testid="stage-map-d" />,
}));

function muni(over: Partial<Municipality> = {}): Municipality {
  return {
    code: '04101',
    name: '青葉区',
    prefecture: '宮城県',
    region: '東北',
    lat: 38,
    lng: 140,
    population: 1,
    difficulty: 'easy',
    kana: 'あおばく',
    ...over,
  } as Municipality;
}

const modeA: ModeAQuestion = {
  kind: 'A',
  name: '伊達市',
  instances: [muni({ code: '01233', name: '伊達市', prefecture: '北海道' })],
  correctPrefectures: new Set(['北海道']),
};
const modeB: SingleQuestion = {
  kind: 'BCD',
  mode: 'B',
  municipality: muni(),
  choices: ['宮城県', '山形県', '福島県', '岩手県'],
};
const modeD: SingleQuestion = {
  kind: 'BCD',
  mode: 'D',
  municipality: muni(),
  choices: ['青葉区', '若林区', '太白区', '泉区'],
};

const questions: readonly Question[] = [modeA, modeB, modeD];

function sessionFor(current: Question, modeDFailed = false) {
  return {
    qIdx: 0,
    currentQuestion: current,
    feedback: 'idle' as const,
    modeDFailed,
    selectedPrefectures: new Set<string>(),
    selectedChoice: null,
    correctCodes: [],
    wrongCodes: [],
    timeLeft: 30,
    handlePrefectureTap: () => {},
    handleModeASubmit: () => {},
    handleChoice: () => {},
    handleDTap: () => {},
    handleModeDFallback: () => {},
    intro: {
      phase: 'steady' as const,
      plan: {
        mode: 'motion' as const,
        holdMs: 1000,
        transitionMs: 320,
        enlargedBandPx: null,
        enlargedTextPx: null,
      },
      settled: true,
      requestIntro: () => {},
    },
  };
}

let host: HTMLDivElement;
let root: Root;

function render(current: Question, modeDFailed = false) {
  act(() => {
    root.render(
      <ImmersiveQuizView
        questions={questions}
        session={sessionFor(current, modeDFailed)}
        onAbort={() => {}}
      />,
    );
  });
}

/** 枠として一度も変わってはいけない部分だけを取り出す。 */
function frameShape() {
  const shell = host.firstElementChild as HTMLElement | null;
  return {
    shell: shell?.className ?? null,
    hasTopHud: !!host.querySelector('header'),
    hasBottomHud: !!host.querySelector('footer'),
    hasAbort: !!host.querySelector('[aria-label="クイズを中断する"]'),
    progress: host.querySelector('header')?.textContent?.includes('1 / 3') ?? false,
  };
}

const choiceLabels = () =>
  [...host.querySelectorAll('button')]
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => modeB.choices.includes(t) || modeD.choices.includes(t));

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('復習セッションの枠', () => {
  it('A・B・D のどれでも枠の構成が変わらない', () => {
    render(modeA);
    const a = frameShape();
    render(modeB);
    const b = frameShape();
    render(modeD);
    const d = frameShape();

    expect(a.hasTopHud && a.hasBottomHud && a.hasAbort && a.progress).toBe(true);
    expect(b).toEqual(a);
    expect(d).toEqual(a);
  });

  it('4択は枠の中の下端側に出す（別画面へ飛ばさない）', () => {
    render(modeB);

    expect(choiceLabels()).toEqual(modeB.choices);
    const footer = host.querySelector('footer');
    const choiceButton = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === modeB.choices[0],
    );
    if (!footer || !choiceButton) throw new Error('帯と選択肢のどちらかが出ていない');

    // 選択肢は帯の中ではなく、帯の直前に置く。帯は高さを固定していて選択肢を飲み込めない。
    expect(footer.contains(choiceButton)).toBe(false);
    expect(
      choiceButton.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('地図問題では4択を出さない', () => {
    render(modeD);

    expect(choiceLabels()).toEqual([]);
    expect(host.querySelector('[data-testid="stage-map-d"]')).not.toBeNull();
  });

  it('モード D が4択へ落ちても枠は維持する', () => {
    render(modeD);
    const beforeFallback = frameShape();

    render(modeD, true);

    expect(frameShape()).toEqual(beforeFallback);
    expect(choiceLabels()).toEqual(modeD.choices);
    expect(host.textContent).toContain('地図データの読み込みに失敗しました');
  });
});
