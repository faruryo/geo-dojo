import 'server-only';
import { createServerClient } from '@/lib/supabase/server';

/**
 * リクエスト単位の認証ヘルパ。`userId` を1回の認証で解決する。
 *
 * NOTE: 以前 `getClaims()`（非対称鍵ならローカル検証）を試したが、本番/preview の
 * 現行構成（対称 HS256・JWT 署名鍵未設定）では `getClaims` が内部で `getSession()` +
 * `getUser()` を入れ子に呼び、GoTrue ロックの取り合いで認証後の SSR が 300s ハングした
 * （preview ランタイムログで確認）。実効メリットが無い上に危険なため、実績のある
 * `getUser()` 直呼びに戻す。非対称署名鍵を本番で有効化したら getClaims 化を再検討する
 * （research.md のデプロイ前チェックリスト参照）。
 *
 * @returns userId（未認証なら null）
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
