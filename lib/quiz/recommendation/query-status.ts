/**
 * identity（browser-user-id）と推薦クエリを1つの UI 状態に畳む。
 * 推薦クエリだけを見ると、identity 失敗時に再試行が空振りし、取得中に失敗 UI が出る。
 */
export function mergeIdentityRecommendationStatus(input: {
  identityPending: boolean;
  identityError: boolean;
  hasUserId: boolean;
  recommendationLoading: boolean;
  recommendationError: boolean;
}): { isLoading: boolean; isError: boolean } {
  if (input.identityPending) return { isLoading: true, isError: false };
  if (input.identityError || !input.hasUserId) return { isLoading: false, isError: true };
  return {
    isLoading: input.recommendationLoading,
    isError: input.recommendationError,
  };
}
