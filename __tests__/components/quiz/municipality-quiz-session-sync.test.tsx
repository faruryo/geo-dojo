// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Municipality } from '@/lib/quiz/municipality-data';
import { useQuizSession, type Question } from '@/components/quiz/use-quiz-session';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let saveResolve: () => void = () => {};
const mockSaveResult = vi.fn(
  () =>
    new Promise<void>((resolve) => {
      saveResolve = resolve;
    })
);

vi.mock('@/app/(app)/quiz/municipality/actions', () => ({
  saveMunicipalityQuizResult: () => mockSaveResult(),
}));

interface TestRunnerProps {
  readonly questions: readonly Question[];
  readonly allMunicipalities: readonly Municipality[];
  readonly onComplete: () => void;
  readonly onReady: (session: ReturnType<typeof useQuizSession>) => void;
}

function TestRunner({
  questions,
  allMunicipalities,
  onComplete,
  onReady,
}: Readonly<TestRunnerProps>) {
  const session = useQuizSession({ questions, allMunicipalities, onComplete });
  useEffect(() => {
    onReady(session);
  });
  return null;
}

describe('Municipality Quiz Session Synchronization & Abort Logic', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  const mockMunicipality: Municipality = {
    code: '13101',
    name: '千代田区',
    prefecture: '東京都',
    region: 'kanto',
    difficulty: 'easy',
  };

  const mockQuestions: Question[] = [
    {
      kind: 'BCD',
      mode: 'B',
      municipality: mockMunicipality,
      choices: ['東京都', '神奈川県', '埼玉県', '千葉県'],
    },
  ];

  it('awaits pending saves and cancels delayed advance timer when production useQuizSession.abort() is called', async () => {
    const onComplete = vi.fn();
    let sessionRef: ReturnType<typeof useQuizSession> | null = null;

    await act(async () => {
      root?.render(
        <TestRunner
          questions={mockQuestions}
          allMunicipalities={[mockMunicipality]}
          onComplete={onComplete}
          onReady={(session) => {
            sessionRef = session;
          }}
        />
      );
    });

    expect(sessionRef).not.toBeNull();

    // 1. Answer question (triggers save and schedules delayed advance)
    act(() => {
      void sessionRef?.handleChoice('東京都', 'B');
    });

    expect(mockSaveResult).toHaveBeenCalledTimes(1);

    // 2. Abort while save is still in flight
    let abortSettled = false;
    let abortPromise: Promise<void> | null = null;

    act(() => {
      abortPromise = sessionRef?.abort().then(() => {
        abortSettled = true;
      }) ?? null;
    });

    expect(abortSettled).toBe(false);

    // 3. Resolve the in-flight save promise
    await act(async () => {
      saveResolve();
      await abortPromise;
    });

    expect(abortSettled).toBe(true);

    // 4. Fast-forward timer past the feedback delay (1200ms)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Assert: onComplete must NOT have been called because abort cleared the advance timer
    expect(onComplete).not.toHaveBeenCalled();
  });
});
