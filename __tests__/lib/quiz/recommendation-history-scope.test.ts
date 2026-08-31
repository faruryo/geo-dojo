import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecommendQuestion,
  finalizeRecommendSession,
  readActiveRecommendUserId,
  readRecommendClientState,
  scopedRecommendKey,
  startRecommendSession,
} from '@/lib/quiz/recommendation/history-cache';

describe('scopedRecommendKey', () => {
  it('namespaces recommendation storage by user id', () => {
    expect(scopedRecommendKey('geodojo:recommendation:client-state', 'user-a')).not.toBe(
      scopedRecommendKey('geodojo:recommendation:client-state', 'user-b'),
    );
  });
});

describe('active recommend owner', () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the session owner so answers can be appended without a new auth lookup', () => {
    startRecommendSession('user-1', 'sess-1', 'A');
    expect(readActiveRecommendUserId()).toBe('user-1');
    appendRecommendQuestion(readActiveRecommendUserId(), {
      mode: 'A',
      correct: true,
      region: '北海道',
      difficulty: 'easy',
    });
    finalizeRecommendSession(readActiveRecommendUserId());
    expect(readRecommendClientState('user-1').lastA?.questionCount).toBe(1);
    expect(readActiveRecommendUserId()).toBeNull();
  });
});
