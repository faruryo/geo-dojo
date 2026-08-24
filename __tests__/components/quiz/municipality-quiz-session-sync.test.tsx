import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeQuizAdvance, type QuizSessionEntry, type QuizResultEntry } from '@/lib/quiz/quiz-session-core';

describe('Municipality Quiz Session Synchronization & Abort Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('tracks pending saves and cancels delayed advance when abort occurs', async () => {
    let saveResolve: () => void = () => {};
    const mockSaveFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          saveResolve = resolve;
        })
    );

    const entries: QuizSessionEntry[] = [
      {
        municipality: {
          code: '13101',
          name: '千代田区',
          prefecture: '東京都',
          region: 'kanto',
          difficulty: 'easy',
        },
        isCorrect: true,
        mode: 'A',
        answerTimeMs: 1500,
      },
    ];

    let isAborted = false;
    let timerId: NodeJS.Timeout | null = null;
    const onComplete = vi.fn();
    const onAdvance = vi.fn();

    // Session runner tracking pending saves
    const inFlightSaves = new Set<Promise<unknown>>();

    const recordAndAdvance = (delayMs: number) => {
      const savePromise = executeQuizAdvance(entries, [], mockSaveFn);
      inFlightSaves.add(savePromise);
      void savePromise.finally(() => {
        inFlightSaves.delete(savePromise);
      });

      void savePromise.then((updated: QuizResultEntry[]) => {
        if (isAborted) return;
        timerId = setTimeout(() => {
          if (isAborted) return;
          onAdvance(updated);
          // if last question:
          onComplete(updated);
        }, delayMs);
      });

      return savePromise;
    };

    const abortQuiz = async () => {
      isAborted = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      // Wait for all in-flight saves
      await Promise.allSettled(Array.from(inFlightSaves));
    };

    // 1. Answer question (triggers save and schedules delayed advance)
    void recordAndAdvance(1200);
    expect(mockSaveFn).toHaveBeenCalledTimes(1);
    expect(inFlightSaves.size).toBe(1);

    // 2. Abort while save is still in flight
    let abortSettled = false;
    const abortPromise = abortQuiz().then(() => {
      abortSettled = true;
    });
    expect(abortSettled).toBe(false);

    // 3. Save finishes
    saveResolve();
    await abortPromise;
    expect(abortSettled).toBe(true);

    // 4. Fast forward time past the 1200ms delay
    vi.advanceTimersByTime(2000);

    // Assert: advance and complete callbacks must NOT have run after abort
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
