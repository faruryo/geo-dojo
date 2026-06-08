/**
 * ダッシュボード数値一致テスト用の隔離シード（T004）。
 *
 * 既存ローカルデータと衝突しないよう、毎回ランダムな synthetic userId を生成し、
 * その user 配下にのみ行を投入する。テスト後は cleanup で完全に消す。
 * municipality_master は既存（環境依存）を流用し、シードしない。
 *
 * 時刻: 「prev」は 48h 前（JST オフセットを跨いでも確実に当日0:00より前）、
 *       「today」は now（当日0:00以降）として投入する。
 */
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { municipalityQuizResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const HOUR = 60 * 60 * 1000;

/** prev(48h前) と today(now) を混在させた既知の回答ログ。 */
function buildRows(userId: string) {
  const prev = new Date(Date.now() - 48 * HOUR);
  const today = new Date();
  const base = {
    userId,
    municipalityName: 'テスト市',
    prefecture: 'テスト県',
  };
  return [
    // --- prev（当日0:00より前）4 件 ---
    { ...base, municipalityCode: 'T01', mode: 'A', isCorrect: true, answeredAt: prev },
    { ...base, municipalityCode: 'T01', mode: 'A', isCorrect: false, answeredAt: prev },
    { ...base, municipalityCode: 'T02', mode: 'B', isCorrect: true, answeredAt: prev },
    { ...base, municipalityCode: 'T02', mode: 'A', isCorrect: false, answeredAt: prev },
    // --- today（当日0:00以降）3 件 ---
    { ...base, municipalityCode: 'T03', mode: 'A', isCorrect: true, answeredAt: today },
    { ...base, municipalityCode: 'T03', mode: 'A', isCorrect: true, answeredAt: today },
    { ...base, municipalityCode: 'T01', mode: 'B', isCorrect: false, answeredAt: today },
  ];
}

/** synthetic user を作って既知ログを投入し、その userId を返す。 */
export async function seedSummaryUser(): Promise<string> {
  const userId = randomUUID();
  await db.insert(municipalityQuizResults).values(buildRows(userId));
  return userId;
}

/** シードした user の行を完全に削除する。 */
export async function cleanupSummaryUser(userId: string): Promise<void> {
  await db
    .delete(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, userId));
}
