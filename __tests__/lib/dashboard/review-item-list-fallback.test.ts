/**
 * getReviewItemList: 正答率取得（getItemAccuracyData）が失敗しても一覧本体の
 * 取得・返却はブロックされないことの検証（013-review-item-accuracy, FR-006）。
 *
 * getReviewItemList は 'use server' の Server Action で、認証は
 * @/lib/auth/current-user 経由（内部で next/headers 由来の cookies() に依存する
 * Supabase server client を使う）。テストのリクエストコンテキスト外から直接
 * 呼び出すために getCurrentUserId をモックし、既知の synthetic userId を返す。
 * getItemAccuracyData は queries.ts の他エクスポート（実装）はそのままに、
 * この関数のみを例外送出するモックに差し替えて障害を再現する。
 *
 * DB 統合テスト: DATABASE_URL 未設定時はスキップ（既定 pnpm test を壊さない）。
 * queries-parity.test.ts とは別ファイルに分離し、vi.mock（ファイル単位で
 * hoist される）が他テストの実モジュール利用に干渉しないようにする。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

const hasDb = !!process.env.DATABASE_URL;
const TEST_USER_ID = randomUUID();

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserId: async () => TEST_USER_ID,
}));

vi.mock('@/app/(app)/dashboard/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(app)/dashboard/queries')>();
  return {
    ...actual,
    getItemAccuracyData: async () => {
      throw new Error('simulated getItemAccuracyData failure');
    },
  };
});

describe.skipIf(!hasDb)('getReviewItemList: accuracy 取得失敗時のフォールバック (FR-006)', () => {
  beforeAll(async () => {
    const { db } = await import('@/lib/db');
    const { srsRecords } = await import('@/lib/db/schema');
    await db.insert(srsRecords).values({
      userId: TEST_USER_ID,
      municipalityCode: 'T01',
      municipalityName: 'テスト市',
      prefecture: 'テスト県',
      mode: 'A',
      status: 'reviewing',
    });
  });

  afterAll(async () => {
    const { db } = await import('@/lib/db');
    const { srsRecords } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(srsRecords).where(eq(srsRecords.userId, TEST_USER_ID));
  });

  it('例外を再スローせず、items を返し accuracy は undefined になる', async () => {
    // getItemAccuracyData のモックは quiz_results が0件の場合と同じ「空の結果」を
    // 返しうるため、accuracy===undefined だけでは catch 節を実際に通ったかを
    // 判別できない。console.error スパイで、例外が確かに捕捉されたことを確認する。
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getReviewItemList } = await import('@/app/(app)/dashboard/actions');
    const result = await getReviewItemList();

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].municipalityCode).toBe('T01');
    expect(result.items[0].mode).toBe('A');
    expect(result.items[0].accuracy).toBeUndefined();
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
