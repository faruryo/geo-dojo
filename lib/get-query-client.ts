import {
  QueryClient,
  isServer,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
      dehydrate: {
        // 既定では success のみ dehydrate。本実装は prefetch を await するため
        // 全クエリが settled 済みで問題ない。
        shouldDehydrateQuery: defaultShouldDehydrateQuery,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * サーバ: リクエストごとに新しい QueryClient（横断汚染を避ける）。
 * ブラウザ: シングルトン。
 */
export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
