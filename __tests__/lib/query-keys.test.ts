import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/query-keys';

describe('queryKeys.recommendation', () => {
  it('keeps a shared prefix and distinct per-user cache keys', () => {
    expect(queryKeys.recommendation.user('user-a')).not.toEqual(
      queryKeys.recommendation.user('user-b'),
    );
    expect(queryKeys.recommendation.user('user-a')[0]).toBe(queryKeys.recommendation.all[0]);
  });
});

describe('queryKeys.browserUserId', () => {
  it('is a stable identity key separate from recommendation', () => {
    expect(queryKeys.browserUserId).toEqual(['browser-user-id']);
    expect(queryKeys.browserUserId[0]).not.toBe(queryKeys.recommendation.all[0]);
  });
});
