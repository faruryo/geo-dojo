/**
 * Mode B/C の難易度別進捗のクリア数（DB 統合テスト）。
 *
 * 政令市は区ごとに難易度が違うため、組（市名と都道府県）は複数の難易度の母数に入る。
 * どの区で正解しても、その組が属するすべての難易度でクリアに数えること、
 * 東京23区の正解は数えないことを確かめる。master は既存データを流用する。
 *
 * DATABASE_URL 未設定時はスキップ。
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('getDifficultyProgressData: Mode B/C の組単位クリア', () => {
  const userId = randomUUID();
  let unitDifficulties: Set<string>;
  let q: typeof import('@/app/(app)/dashboard/queries');

  beforeAll(async () => {
    const { db } = await import('@/lib/db');
    const { municipalityMaster, municipalityQuizResults } = await import('@/lib/db/schema');
    const { and, eq } = await import('drizzle-orm');
    q = await import('@/app/(app)/dashboard/queries');

    const wards = await db
      .select({ code: municipalityMaster.code, difficulty: municipalityMaster.difficulty })
      .from(municipalityMaster)
      .where(and(eq(municipalityMaster.name, '名古屋市'), eq(municipalityMaster.prefecture, '愛知県')));
    unitDifficulties = new Set(wards.map((w) => w.difficulty));

    await db.insert(municipalityQuizResults).values([
      { userId, municipalityCode: wards[0].code, municipalityName: '名古屋市', prefecture: '愛知県', mode: 'B', isCorrect: true },
      { userId, municipalityCode: '13101', municipalityName: '千代田区', prefecture: '東京都', mode: 'B', isCorrect: true },
    ]);
  });

  afterAll(async () => {
    const { db } = await import('@/lib/db');
    const { municipalityQuizResults } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(municipalityQuizResults).where(eq(municipalityQuizResults.userId, userId));
  });

  it.each(['B', 'all'] as const)('mode=%s: 名古屋市の区の難易度すべてで1、千代田区は数えない', async (mode) => {
    expect(unitDifficulties.size).toBeGreaterThan(1);
    const rows = await q.getDifficultyProgressData(userId, { mode, region: '全国' });
    for (const r of rows) {
      expect(Number(r.clearedCount), r.difficulty).toBe(unitDifficulties.has(r.difficulty) ? 1 : 0);
    }
  });
});
