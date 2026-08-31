'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';

function AuthCacheReset({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      queryClient.removeQueries({ queryKey: queryKeys.browserUserId });
      queryClient.removeQueries({ queryKey: queryKeys.recommendation.all });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return children;
}

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheReset>{children}</AuthCacheReset>
    </QueryClientProvider>
  );
}
