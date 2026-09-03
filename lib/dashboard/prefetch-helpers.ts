import 'server-only';
import { dehydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { PREFETCH_TIMEOUT_MS } from '@/lib/dashboard/prefetch-config';

export async function safeDehydrateWithTimeout(
  queryClient: QueryClient,
  prefetchPromise: Promise<unknown>,
  timeoutMs: number = PREFETCH_TIMEOUT_MS,
): Promise<DehydratedState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const result = await Promise.race([prefetchPromise.then(() => 'ok' as const), timeout]);
    return result === 'timeout' ? null : dehydrate(queryClient);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
