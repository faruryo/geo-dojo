import 'server-only';
import { createServerClient } from '@/lib/supabase/server';

/**
 * リクエスト単位の認証ヘルパ。
 *
 * `getClaims()` は非対称署名鍵（JWKS）が有効ならローカルで JWT を検証し、
 * GoTrue へのネットワーク往復をゼロにする。鍵未対応（対称鍵）時は内部で
 * `getUser()` にフォールバックするため、いずれの場合もセキュリティ（署名検証）は
 * 維持される。サーバ側プリフェッチと組み合わせ、初回表示の認証往復を削減する。
 *
 * @returns userId（未認証なら null）
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!error && typeof sub === 'string' && sub) {
    return sub;
  }

  // 念のためのフォールバック（getClaims が claims を返せなかった場合）
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
