// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useQuizActions } from '@/components/quiz/use-quiz-actions';
import type { Question, SingleQuestion } from '@/components/quiz/use-quiz-session';
import { useQuizState } from '@/components/quiz/use-quiz-state';
import type { Municipality } from '@/lib/quiz/municipality-data';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

// DB 保存 Server Action をモック
let mockSaveDeferred: {
  promise: Promise<{ success: boolean }>;
  resolve: (val: { success: boolean }) => void;
  reject: (err: unknown) => void;
} | null = null;

vi.mock('@/app/(app)/quiz/municipality/actions', () => ({
  saveMunicipalityQuizResults: vi.fn(() => {
    if (mockSaveDeferred) {
      return mockSaveDeferred.promise;
    }
    return Promise.resolve({ success: true });
  }),
}));

vi.mock('@/lib/quiz/sound-effects', () => ({
  playSe: vi.fn(),
  playCorrectSe: vi.fn(),
  isAudioContextRunning: vi.fn(() => false),
  completionSeEvent: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sampleMuni(over: Partial<Municipality> = {}): Municipality {
  return {
    code: '01101',
    name: '中央区',
    prefecture: '北海道',
    region: '北海道',
    population: 230000,
    difficulty: 'easy',
    ...over,
  };
}

const mockQuestionB: SingleQuestion = {
  kind: 'BCD',
  mode: 'B',
  municipality: sampleMuni(),
  choices: ['北海道', '青森県', '秋田県', '岩手県'],
};

interface TestHarnessHandle {
  actions: ReturnType<typeof useQuizActions>;
  state: ReturnType<typeof useQuizState>;
}

let handle: TestHarnessHandle;
let host: HTMLDivElement;
let root: Root;

function TestComponent({
  currentQuestion,
  onAdvance,
}: {
  currentQuestion: Question | null;
  onAdvance?: () => void;
}) {
  const state = useQuizState(10, () => {});
  const prevQIdxRef = React.useRef(state.qIdx);

  React.useEffect(() => {
    if (state.qIdx !== prevQIdxRef.current) {
      prevQIdxRef.current = state.qIdx;
      onAdvance?.();
    }
  }, [state.qIdx, onAdvance]);

  const actions = useQuizActions({
    currentQuestion,
    allMunicipalities: [mockQuestionB.municipality],
    state,
  });

  handle = { actions, state };
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSaveDeferred = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useQuizActions: 進行制御・スキップ・誤タップガード (US2)', () => {
  it('自動遷移が一律 2.0秒 (2000ms) に統一されている (FR-004e)', async () => {
    const onAdvance = vi.fn();
    act(() => {
      root.render(<TestComponent currentQuestion={mockQuestionB} onAdvance={onAdvance} />);
    });

    // 解答アクションを実行 (Mode B)
    await act(async () => {
      await handle.actions.handleChoice('北海道', 'B');
    });

    // 解答直後は保存が完了してフィードバック中だが、まだ遷移していない
    expect(onAdvance).not.toHaveBeenCalled();

    // 1999ms 経過時点でもまだ遷移しない
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onAdvance).not.toHaveBeenCalled();

    // 2000ms 経過で次問へ遷移する
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('保存待機中のスキップ要求が保留され、保存完了時に待機時間ゼロで即遷移する (FR-004b)', async () => {
    const deferred = createDeferred<{ success: boolean }>();
    mockSaveDeferred = deferred;
    const onAdvance = vi.fn();

    act(() => {
      root.render(<TestComponent currentQuestion={mockQuestionB} onAdvance={onAdvance} />);
    });

    // 回答実行（非同期保存が開始されるが完了していない）
    let choicePromise: Promise<void>;
    act(() => {
      choicePromise = handle.actions.handleChoice('北海道', 'B');
    });

    // 保存中にスキップ要求を発火 (FR-004b)
    act(() => {
      handle.actions.handleSkip?.();
    });

    // まだ保存が未完了なので遷移しない
    expect(onAdvance).not.toHaveBeenCalled();

    // 保存が完了する
    await act(async () => {
      deferred.resolve({ success: true });
      await choicePromise;
    });

    // 保存完了と同時に遅延ゼロ（タイマーを待たずに）遷移する
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('保存完了後の待機時間中にスキップ要求で即座に次問へ遷移する (FR-004a, SC-004)', async () => {
    const onAdvance = vi.fn();
    act(() => {
      root.render(<TestComponent currentQuestion={mockQuestionB} onAdvance={onAdvance} />);
    });

    await act(async () => {
      await handle.actions.handleChoice('北海道', 'B');
    });

    expect(onAdvance).not.toHaveBeenCalled();

    // 待機中にスキップ要求を呼ぶ
    act(() => {
      handle.actions.handleSkip?.();
    });

    // 2000ms 待たずに即時遷移する
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('次問切り替え直後 250ms 間はすべての回答入力を無視する誤タップガード (FR-004d)', async () => {
    const onAdvance = vi.fn();
    act(() => {
      root.render(<TestComponent currentQuestion={mockQuestionB} onAdvance={onAdvance} />);
    });

    await act(async () => {
      await handle.actions.handleChoice('北海道', 'B');
    });

    // 2000ms 経過で次問へ遷移
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // 遷移直後 (50ms後) に連打で次の回答を入力しようとする
    act(() => {
      vi.advanceTimersByTime(50);
    });
    await act(async () => {
      await handle.actions.handleChoice('青森県', 'B');
    });

    // 誤タップガードによりフィードバックは idle のままで無視される
    expect(handle.state.feedback).toBe('idle');

    // 250ms が完全に経過する (合計 251ms)
    act(() => {
      vi.advanceTimersByTime(201);
    });

    // ガード解除後の回答は正常に受け付けられる
    await act(async () => {
      await handle.actions.handleChoice('青森県', 'B');
    });
    expect(handle.state.feedback).toBe('incorrect');
  });

  it('キーボード Space/Enter でスキップでき、event.repeat は無視される (FR-004a, FR-004c)', async () => {
    const onAdvance = vi.fn();
    act(() => {
      root.render(<TestComponent currentQuestion={mockQuestionB} onAdvance={onAdvance} />);
    });

    await act(async () => {
      await handle.actions.handleChoice('北海道', 'B');
    });

    expect(onAdvance).not.toHaveBeenCalled();

    // event.repeat === true のキーイベントは無視される
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true }),
      );
    });
    expect(onAdvance).not.toHaveBeenCalled();

    // 通常の Space 押下で即時スキップされる
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false }),
      );
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
