/**
 * 015-kana-support: getWeaknessRankingData / getDueReviewItems / getReviewItemList が
 * municipality_master.kana を正しく返すことの検証（T020）。
 *
 * municipality_master に一致しない synthetic code（T01 等）を使う既存のダッシュボード
 * テスト（queries-parity.test.ts 等）とは別に、専用の municipality_master 行を1件
 * 挿入・削除して kana の伝播だけを検証する。
 *
 * DB 統合テスト: DATABASE_URL 未設定時はスキップ（既定 pnpm test を壊さない）。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

const hasDb = !!process.env.DATABASE_URL;
const TEST_USER_ID = randomUUID();
const TEST_CODE = 'ZK001';
const TEST_KANA = 'かなてすとし';

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserId: async () => TEST_USER_ID,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: TEST_USER_ID } }, error: null }),
    },
  }),
}));

describe.skipIf(!hasDb)('kana propagation (T020)', () => {
  beforeAll(async () => {
    const { db } = await import('@/lib/db');
    const { municipalityMaster, municipalityQuizResults, srsRecords } = await import('@/lib/db/schema');

    await db.insert(municipalityMaster).values({
      code: TEST_CODE,
      name: 'かなテスト市',
      prefecture: 'テスト県',
      region: 'テスト',
      difficulty: 'easy',
      kana: TEST_KANA,
    });

    await db.insert(municipalityQuizResults).values({
      userId: TEST_USER_ID,
      municipalityCode: TEST_CODE,
      municipalityName: 'かなテスト市',
      prefecture: 'テスト県',
      mode: 'A',
      isCorrect: false,
    });

    await db.insert(srsRecords).values({
      userId: TEST_USER_ID,
      municipalityCode: TEST_CODE,
      municipalityName: 'かなテスト市',
      prefecture: 'テスト県',
      mode: 'A',
      status: 'reviewing',
      dueDate: new Date(Date.now() - 60_000), // 過去 = due
    });
  });

  afterAll(async () => {
    const { db } = await import('@/lib/db');
    const { municipalityMaster, municipalityQuizResults, srsRecords } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(municipalityQuizResults).where(eq(municipalityQuizResults.userId, TEST_USER_ID));
    await db.delete(srsRecords).where(eq(srsRecords.userId, TEST_USER_ID));
    await db.delete(municipalityMaster).where(eq(municipalityMaster.code, TEST_CODE));
  });

  it('getWeaknessRankingData: kana が返る', async () => {
    const { getWeaknessRankingData } = await import('@/app/(app)/dashboard/queries');
    const rows = await getWeaknessRankingData(TEST_USER_ID);
    const row = rows.find((r) => r.municipalityCode === TEST_CODE);
    expect(row?.kana).toBe(TEST_KANA);
  });

  it('getDueReviewItems: kana が返る', async () => {
    const { getDueReviewItems } = await import('@/app/(app)/quiz/review/actions');
    const items = await getDueReviewItems({ limit: 20 });
    const item = items.find((i) => i.municipalityCode === TEST_CODE);
    expect(item?.kana).toBe(TEST_KANA);
  });

  it('getReviewItemList: kana が返る', async () => {
    const { getReviewItemList } = await import('@/app/(app)/dashboard/actions');
    const result = await getReviewItemList({ limit: 50 });
    const item = result.items.find((i) => i.municipalityCode === TEST_CODE);
    expect(item?.kana).toBe(TEST_KANA);
  });

  it('getReviewItemList: master に無い code でも行は落ちない（leftJoin, FR-005）', async () => {
    const { db } = await import('@/lib/db');
    const { srsRecords } = await import('@/lib/db/schema');
    const noMasterCode = 'ZK-NOPE';
    await db.insert(srsRecords).values({
      userId: TEST_USER_ID,
      municipalityCode: noMasterCode,
      municipalityName: '存在しない市',
      prefecture: 'テスト県',
      mode: 'B',
      status: 'reviewing',
    });

    const { getReviewItemList } = await import('@/app/(app)/dashboard/actions');
    const result = await getReviewItemList({ limit: 50 });
    const item = result.items.find((i) => i.municipalityCode === noMasterCode);
    expect(item).toBeDefined();
    expect(item?.kana).toBeUndefined();
  });
});
