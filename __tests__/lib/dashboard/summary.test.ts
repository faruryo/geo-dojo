/**
 * getDashboardSummaryData の数値一致リグレッションテスト（T006 / AC4）。
 *
 * 直列クエリ → Promise.all 並列化（US1）後も、固定シードに対する主要指標が
 * ゴールデンと一致することを保証する。
 *
 * DB 統合テスト: ローカル supabase（pnpm dev の supabase start）等の Postgres が
 * 必要。`DATABASE_URL` 未設定時はスキップし、既定の `pnpm test` を壊さない。
 * 実行例: DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' pnpm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  expectedSummary,
  expectedOverallAccuracy,
  expectedPrevOverallAccuracy,
} from './fixtures/expected-metrics';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('getDashboardSummaryData (parity)', () => {
  let userId: string;
  let summary: Awaited<
    ReturnType<typeof import('@/app/(app)/dashboard/queries')['getDashboardSummaryData']>
  >;
  let totalSlots: number;

  beforeAll(async () => {
    const { seedSummaryUser } = await import('./seed');
    const { getDashboardSummaryData, getMasterPoolSize } = await import(
      '@/app/(app)/dashboard/queries'
    );
    userId = await seedSummaryUser();
    summary = await getDashboardSummaryData(userId);
    totalSlots = await getMasterPoolSize('all');
  });

  afterAll(async () => {
    if (!userId) return;
    const { cleanupSummaryUser } = await import('./seed');
    await cleanupSummaryUser(userId);
  });

  // 注: studiedCount / clearedCount は raw COUNT(DISTINCT ...) のため postgres が
  // 文字列で返す（既存挙動・US1 で不変）。AC4 は数値一致のため Number() で値を照合する。
  it('全期間の主要指標がゴールデンと一致', () => {
    expect(summary.totalQuestions).toBe(expectedSummary.totalQuestions);
    expect(summary.totalCorrect).toBe(expectedSummary.totalCorrect);
    expect(Number(summary.studiedCount)).toBe(expectedSummary.studiedCount);
    expect(Number(summary.clearedCount)).toBe(expectedSummary.clearedCount);
    expect(summary.overallAccuracy).toBeCloseTo(expectedOverallAccuracy, 10);
  });

  it('prev（当日0:00より前）の主要指標がゴールデンと一致', () => {
    expect(summary.prev.totalQuestions).toBe(expectedSummary.prev.totalQuestions);
    expect(summary.prev.totalCorrect).toBe(expectedSummary.prev.totalCorrect);
    expect(Number(summary.prev.studiedCount)).toBe(expectedSummary.prev.studiedCount);
    expect(Number(summary.prev.clearedCount)).toBe(expectedSummary.prev.clearedCount);
    expect(summary.prev.overallAccuracy).toBeCloseTo(expectedPrevOverallAccuracy, 10);
  });

  it('coverageRate は cleared / master プール（同一式）で導出される', () => {
    const expectedCoverage =
      totalSlots > 0 ? expectedSummary.clearedCount / totalSlots : 0;
    const expectedPrevCoverage =
      totalSlots > 0 ? expectedSummary.prev.clearedCount / totalSlots : 0;
    expect(summary.totalMunicipalities).toBe(totalSlots);
    expect(summary.coverageRate).toBeCloseTo(expectedCoverage, 10);
    expect(summary.prev.coverageRate).toBeCloseTo(expectedPrevCoverage, 10);
  });
});
