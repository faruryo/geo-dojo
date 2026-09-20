// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import type { SingleQuestion } from '@/components/quiz/use-quiz-session';
import type { Municipality } from '@/lib/quiz/municipality-data';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/app/(app)/quiz/municipality/actions', () => ({
  saveMunicipalityQuizResults: vi.fn(() =>
    Promise.resolve({ quizPersisted: true, srsPersisted: true }),
  ),
}));

vi.mock('@/lib/quiz/sound-effects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/quiz/sound-effects')>();
  return {
    ...actual,
    playSe: vi.fn(),
    playCorrectSe: vi.fn(),
    isAudioContextRunning: vi.fn(() => false),
    completionSeEvent: vi.fn(),
  };
});

const mockMuni1: Municipality = {
  code: '14100',
  name: '横浜市',
  prefecture: '神奈川県',
  region: '関東',
  population: 3777000,
  difficulty: 'medium',
  kana: 'よこはまし',
};

const mockMuni2: Municipality = {
  code: '01100',
  name: '札幌市',
  prefecture: '北海道',
  region: '北海道',
  population: 1970000,
  difficulty: 'easy',
  kana: 'さっぽろし',
};

const mockQuestions: SingleQuestion[] = [
  {
    kind: 'BCD',
    mode: 'B',
    municipality: mockMuni1,
    choices: ['神奈川県', '東京都', '千葉県', '埼玉県'],
  },
  {
    kind: 'BCD',
    mode: 'B',
    municipality: mockMuni2,
    choices: ['北海道', '青森県', '秋田県', '岩手県'],
  },
];

describe('ChoiceOnlyQuizView (Mode B/C 4択クイズのレイアウト安定性とポップアップ表示)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    vi.useRealTimers();
  });

  function renderQuiz(onComplete = vi.fn()) {
    act(() => {
      root.render(
        <QuizRunner
          questions={mockQuestions}
          allMunicipalities={[mockMuni1, mockMuni2]}
          onAbort={vi.fn()}
          onComplete={onComplete}
        />,
      );
    });
  }

  async function answerFirstQuestion() {
    renderQuiz();
    const choiceButtons = host.querySelectorAll('button');
    const kanagawaBtn = Array.from(choiceButtons).find((b) => b.textContent?.includes('神奈川県'));
    await act(async () => {
      kanagawaBtn?.click();
    });
    return { kanagawaBtn };
  }

  it('回答前はお題カードと選択肢のみが表示され、FloatingFeedbackCardは表示されない', () => {
    renderQuiz();

    expect(host.textContent).toContain('この市区町村はどの都道府県？');
    expect(host.textContent).toContain('横浜市');
    expect(host.textContent).not.toContain('🎉 正解！');
    expect(host.textContent).not.toContain('✗ 不正解');

    // 4つの選択肢ボタンが存在
    const buttons = host.querySelectorAll('button');
    const choiceLabels = Array.from(buttons).map((b) => b.textContent);
    expect(choiceLabels).toContain('神奈川県');
    expect(choiceLabels).toContain('東京都');
  });

  it('回答後に選択肢のDOM位置を押し下げず、お題カードの上にFloatingFeedbackCardがポップアップ表示される', async () => {
    const { kanagawaBtn } = await answerFirstQuestion();

    // FloatingFeedbackCard がポップアップ（top-1/2 -translate-y-1/2）としてオーバーレイ出現
    const feedbackCard = host.querySelector('[role="status"]')?.parentElement;
    expect(feedbackCard).not.toBeNull();
    expect(feedbackCard?.className).toContain('top-1/2');
    expect(feedbackCard?.className).toContain('-translate-y-1/2');

    // 正解フィードバック情報がポップアップ内に表示される
    expect(host.textContent).toContain('🎉 正解！');
    expect(host.textContent).toContain('横浜市');
    expect(host.textContent).toContain('よこはまし');
    expect(host.textContent).toContain('約377.7万人');

    // お題カード直下の選択肢は依然として4つ存在し、正解ボタンが緑スタイルになっている
    expect(kanagawaBtn?.className).toContain('border-green-500');
  });

  it('ポップアップカードをクリックすると即座に次問へスキップする', async () => {
    await answerFirstQuestion();
    expect(host.textContent).toContain('横浜市');

    // ポップアップカードをクリック
    const feedbackCard = host.querySelector('[role="status"]')?.parentElement;
    expect(feedbackCard).not.toBeNull();
    act(() => {
      feedbackCard?.click();
    });

    // 2問目（札幌市）へ即時遷移
    expect(host.textContent).not.toContain('🎉 正解！');
    expect(host.textContent).toContain('札幌市');
  });

  it('Space キー押下でポップアップから即座に次問へスキップする', async () => {
    await answerFirstQuestion();
    expect(host.textContent).toContain('🎉 正解！');

    // Space キーでスキップ
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false }),
      );
    });

    // 2問目（札幌市）へ即時遷移
    expect(host.textContent).not.toContain('🎉 正解！');
    expect(host.textContent).toContain('札幌市');
  });
});
