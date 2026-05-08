import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Component / Route Handler 用 — Cookie からセッションを読み取る
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から呼ばれた場合は set 不可（読み取りのみ）
          }
        },
      },
    },
  );
}
