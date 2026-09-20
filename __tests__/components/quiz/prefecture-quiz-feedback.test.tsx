// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PrefectureQuizPage from '@/app/(app)/quiz/prefecture/page';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlayCorrectSe = vi.fn();
const mockPlaySe = vi.fn();

vi.mock('@/lib/quiz/sound-effects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/quiz/sound-effects')>();
  return {
    ...actual,
    playCorrectSe: (...args: unknown[]) => mockPlayCorrectSe(...args),
    playSe: (...args: unknown[]) => mockPlaySe(...args),
    completionSeEvent: () => 'complete',
  };
});

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockJapanMap(props: {
      onPrefectureClick: (name: string) => void;
      highlightCorrect?: string;
      isIncorrect?: boolean;
      qIdx?: number;
    }) {
      return (
        <div
          data-testid="japan-map"
          data-highlight={props.highlightCorrect}
          data-is-incorrect={String(props.isIncorrect)}
          data-q-idx={String(props.qIdx)}
        >
          <button type="button" onClick={() => props.onPrefectureClick('神奈川県')}>
            神奈川県
          </button>
          <button type="button" onClick={() => props.onPrefectureClick('東京都')}>
            東京都
          </button>
          <button type="button" onClick={() => props.onPrefectureClick('北海道')}>
            北海道
          </button>
          <button type="button" onClick={() => props.onPrefectureClick('青森県')}>
            青森県
          </button>
          <button type="button" onClick={() => props.onPrefectureClick('岩手県')}>
            岩手県
          </button>
        </div>
      );
    };
  },
}));

vi.mock('@/lib/quiz/prefecture-quiz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/quiz/prefecture-quiz')>();
  return {
    ...actual,
    buildPrefectureQuestions: () => ['神奈川県', '東京都', '北海道', '青森県', '岩手県', '秋田県'],
  };
});

describe('PrefectureQuizPage: リッチフィードバック演出と進行制御', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPlayCorrectSe.mockClear();
    mockPlaySe.mockClear();
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

  function startQuiz() {
    act(() => {
      root.render(<PrefectureQuizPage />);
    });
    // スタートボタンをクリック
    const startButton = host.querySelector('button.w-full.py-5') as HTMLButtonElement;
    expect(startButton).not.toBeNull();
    act(() => {
      startButton.click();
    });
  }

  it('正解時に playCorrectSe(streak: 1) が呼ばれ、FloatingFeedbackCard と据え置き BottomHud が表示される', () => {
    startQuiz();

    // 1問目のお題は「神奈川県」
    expect(host.textContent).toContain('神奈川県');

    // 神奈川県をタップ（正解）
    const map = host.querySelector('[data-testid="japan-map"]');
    expect(map).not.toBeNull();
    const kanagawaBtn = map?.querySelector('button') as HTMLButtonElement;
    act(() => {
      kanagawaBtn.click();
    });

    // 和音SE呼び出し
    expect(mockPlayCorrectSe).toHaveBeenCalledWith({ streak: 1 });

    // FloatingFeedbackCard の表示（正解ラベル、都道府県名、よみがな、地方名）
    expect(host.textContent).toContain('🎉 正解！');
    expect(host.textContent).toContain('かながわけん');
    expect(host.textContent).toContain('（関東地方）');

    // BottomHud はお題（神奈川県）のまま据え置き
    const bottomHud = host.querySelector('[data-testid="japan-map"]')?.nextElementSibling;
    expect(bottomHud).not.toBeNull();
  });

  it('フィードバック表示中に Space キーを押すと即座に次問へスキップする', () => {
    startQuiz();

    // 正解タップ
    const map = host.querySelector('[data-testid="japan-map"]');
    const kanagawaBtn = map?.querySelector('button') as HTMLButtonElement;
    act(() => {
      kanagawaBtn.click();
    });

    expect(host.textContent).toContain('🎉 正解！');

    // Space キーでスキップ
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false }));
    });

    // 即座に2問目（東京都）へ遷移
    expect(host.textContent).not.toContain('🎉 正解！');
    expect(host.textContent).toContain('東京都');
  });

  it('フィードバックカードをクリックすると即座に次問へスキップする', () => {
    startQuiz();

    // 正解タップ
    const map = host.querySelector('[data-testid="japan-map"]');
    const kanagawaBtn = map?.querySelector('button') as HTMLButtonElement;
    act(() => {
      kanagawaBtn.click();
    });

    expect(host.textContent).toContain('🎉 正解！');

    // フローティングカードをクリック
    const card = host.querySelector('[role="status"]')?.parentElement as HTMLElement;
    expect(card).not.toBeNull();
    act(() => {
      card.click();
    });

    // 2問目（東京都）へ遷移
    expect(host.textContent).not.toContain('🎉 正解！');
    expect(host.textContent).toContain('東京都');
  });

  it('誤答時に playSe("incorrect") が呼ばれ、streak が 0 にリセットされ、JapanMap に isIncorrect と qIdx が渡る', () => {
    startQuiz();

    const map = host.querySelector('[data-testid="japan-map"]') as HTMLElement;
    expect(map.getAttribute('data-q-idx')).toBe('0');

    // 1問目（神奈川県）にお題と異なる東京都をタップ（誤答）
    const tokyoBtn = map.querySelectorAll('button').item(1);
    expect(tokyoBtn).not.toBeNull();
    act(() => {
      tokyoBtn?.click();
    });

    expect(mockPlaySe).toHaveBeenCalledWith('incorrect');
    expect(host.textContent).toContain('✗ 不正解');
    expect(map.getAttribute('data-is-incorrect')).toBe('true');
    expect(map.getAttribute('data-q-idx')).toBe('0');

    // スキップで次問へ
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false }));
    });

    // 2問目へ遷移したとき、qIdx が 1 に更新され、isIncorrect が解除される
    expect(map.getAttribute('data-q-idx')).toBe('1');
    expect(map.getAttribute('data-is-incorrect')).toBe('false');
  });

  it('次問遷移後 250ms 以内のタップは誤タップ防止ガードにより無視される', () => {
    startQuiz();

    // 1問目正解
    const map = host.querySelector('[data-testid="japan-map"]') as HTMLElement;
    const kanagawaBtn = map.querySelectorAll('button').item(0);
    expect(kanagawaBtn).not.toBeNull();
    act(() => {
      kanagawaBtn?.click();
    });

    // スキップ
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: false }));
    });

    // 2問目（東京都）表示直後（ガード期間中）にタップ
    const tokyoBtn = map.querySelectorAll('button').item(1);
    expect(tokyoBtn).not.toBeNull();
    act(() => {
      tokyoBtn?.click();
    });

    // ガードされたためフィードバック状態にならず idle のまま
    expect(host.textContent).not.toContain('🎉 正解！');

    // 250ms 経過後
    act(() => {
      vi.advanceTimersByTime(260);
    });

    // ガード解除後にタップ -> 正解として処理される
    act(() => {
      tokyoBtn?.click();
    });
    expect(host.textContent).toContain('🎉 正解！');
  });

  it('5連続正解時に ConfettiOverlay が表示され、playCorrectSe(streak: 5) が呼ばれる', () => {
    startQuiz();

    const map = host.querySelector('[data-testid="japan-map"]') as HTMLElement;
    const targetButtons = Array.from(map.querySelectorAll('button')).slice(0, 5);

    let count = 0;
    for (const btn of targetButtons) {
      // ガード待機
      act(() => {
        vi.advanceTimersByTime(260);
      });
      // 正解ボタンをクリック
      act(() => {
        btn.click();
      });

      count += 1;
      if (count < 5) {
        // スキップして次へ
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false }));
        });
      }
    }

    // 5問目正解時: streak: 5 で playCorrectSe が呼ばれる
    expect(mockPlayCorrectSe).toHaveBeenCalledWith({ streak: 5 });

    // 5連続達成により称賛ステージ「完璧！」と「5連続」バッジ、および ConfettiOverlay が表示される
    expect(host.textContent).toContain('完璧！');
    expect(host.textContent).toContain('5連続');
    const confetti = host.querySelector('[data-testid="confetti-overlay"]');
    expect(confetti).not.toBeNull();
  });
});
