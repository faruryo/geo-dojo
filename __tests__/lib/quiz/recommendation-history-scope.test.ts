import { describe, expect, it } from 'vitest';
import { scopedRecommendKey } from '@/lib/quiz/recommendation/history-cache';

describe('scopedRecommendKey', () => {
  it('namespaces recommendation storage by user id', () => {
    expect(scopedRecommendKey('geodojo:recommendation:client-state', 'user-a')).not.toBe(
      scopedRecommendKey('geodojo:recommendation:client-state', 'user-b'),
    );
  });
});
