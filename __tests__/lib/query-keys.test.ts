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
