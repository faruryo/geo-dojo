import { describe, expect, it } from 'vitest';
import { mergeIdentityRecommendationStatus } from '@/lib/quiz/recommendation/query-status';

describe('mergeIdentityRecommendationStatus', () => {
  it('treats identity fetch as loading, not recommendation failure', () => {
    expect(
      mergeIdentityRecommendationStatus({
        identityPending: true,
        identityError: false,
        hasUserId: false,
        recommendationLoading: false,
        recommendationError: false,
      }),
    ).toEqual({ isLoading: true, isError: false });
  });

  it('surfaces identity errors so retry can refetch the user first', () => {
    expect(
      mergeIdentityRecommendationStatus({
        identityPending: false,
        identityError: true,
        hasUserId: false,
        recommendationLoading: false,
        recommendationError: false,
      }),
    ).toEqual({ isLoading: false, isError: true });
  });

  it('follows the recommendation query once a user id exists', () => {
    expect(
      mergeIdentityRecommendationStatus({
        identityPending: false,
        identityError: false,
        hasUserId: true,
        recommendationLoading: true,
        recommendationError: false,
      }),
    ).toEqual({ isLoading: true, isError: false });
    expect(
      mergeIdentityRecommendationStatus({
        identityPending: false,
        identityError: false,
        hasUserId: true,
        recommendationLoading: false,
        recommendationError: true,
      }),
    ).toEqual({ isLoading: false, isError: true });
  });
});
