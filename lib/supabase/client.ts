import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// ブラウザ用クライアント（lazy シングルトン）
let _client: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_client) {
      _client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// API Route 用サーバークライアント（Service Role — Bearer トークン検証に使用）
export function createServerClient() {
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    },
  );
}
