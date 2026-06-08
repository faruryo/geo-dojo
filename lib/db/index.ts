import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase Transaction Pooler では prepare: false が必須。
// max: ダッシュボードのサーバ側プリフェッチは複数 read を並列実行し、各 read 内部でも
//   Promise.all で複数サブクエリを発行する（例: summary=9, dueReviewSummary=4）。
//   既定の max:10 では同時要求(~20)に対しプール枯渇し、最重の completionTrend が
//   コネクション待ちで詰まっていた（preview で 25s+ タイムアウト）。Transaction Pooler は
//   プールサイズ超過分をキューするため、クライアント側の上限を引き上げる。
// idle_timeout: サーバレスでアイドル接続を解放する。
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 20,
  idle_timeout: 20,
});
export const db = drizzle(client, { schema });
