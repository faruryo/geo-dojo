import { db } from '@/lib/db';
import { municipalityMaster } from '@/lib/db/schema';

// Lazy-loaded municipality validation set (loaded once, reused across warm invocations).
// NOTE: 以前は public/municipalities.json を fs で読んでいたが、Vercel の serverless
// 関数バンドル(/var/task)に public/ の静的アセットは含まれず ENOENT で全保存が 500 に
// なっていた。DB の municipality_master（クライアントの出題元と同一の信頼できる情報源）を
// 参照することで実行時のファイル依存を排除する（教訓 / PR #12）。
let _validCodes: Set<string> | null = null;

export async function getValidCodes(): Promise<Set<string>> {
  if (_validCodes) return _validCodes;
  const rows = await db.select({ code: municipalityMaster.code }).from(municipalityMaster);
  _validCodes = new Set(rows.map((m) => m.code));
  return _validCodes;
}
