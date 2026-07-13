/**
 * US2 で queries.ts へ純粋化した残り read 関数の数値一致テスト（T012 / AC4）。
 *
 * seed.ts のシード（quiz_results 7件・srs なし、コードは master 非存在）に対し、
 * 各関数が決定的な値を返すことを検証する。master を innerJoin する関数は
 * synthetic code が master に無いため空/ゼロになり、user スコープと集計分岐を
 * 環境非依存に検証できる。完全な数値網羅は summary.test.ts（getDashboardSummaryData）が担う。
 *
 * DB 統合テスト: DATABASE_URL 未設定時はスキップ（既定 pnpm test を壊さない）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('queries.ts purified reads (parity)', () => {
  let userId: string;
  let q: typeof import('@/app/(app)/dashboard/queries');

  beforeAll(async () => {
    const { seedSummaryUser } = await import('./seed');
    q = await import('@/app/(app)/dashboard/queries');
    userId = await seedSummaryUser();
  });

  afterAll(async () => {
    if (!userId) return;
    const { cleanupSummaryUser } = await import('./seed');
    await cleanupSummaryUser(userId);
  });

  it('getStreakData: 直近=今日 + 2日前 → current/longest=1', async () => {
    const s = await q.getStreakData(userId);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
    expect(s.hasPlayedToday).toBe(true);
  });

  it('getCompletionByModeData(all/全国): 正解 distinct mode:code = 3', async () => {
    const c = await q.getCompletionByModeData(userId, { mode: 'all', region: '全国' });
    expect(Number(c.clearedCount)).toBe(3); // A:T01, B:T02, A:T03
  });

  it('getDifficultyProgressData(all/全国): synthetic code は master 非存在 → cleared 0', async () => {
    const rows = await q.getDifficultyProgressData(userId, { mode: 'all', region: '全国' });
    for (const r of rows) {
      expect(Number(r.clearedCount)).toBe(0);
      expect(r.coverageRate).toBe(0);
    }
  });

  it('getWeaknessRankingData: master 非 JOIN ヒットで空', async () => {
    expect(await q.getWeaknessRankingData(userId)).toEqual([]);
  });

  it('getAccuracyTrendData / getCompletionTrendData: master 非 JOIN ヒットで空', async () => {
    expect(
      await q.getAccuracyTrendData(userId, { period: '7d', mode: 'all', region: '全国' }),
    ).toEqual([]);
    expect(
      await q.getCompletionTrendData(userId, { period: 'all', mode: 'all', region: '全国' }),
    ).toEqual([]);
  });

  it('getDueReviewSummaryData: srs なし → 全 0 / nextDueAt=null', async () => {
    const d = await q.getDueReviewSummaryData(userId);
    expect(d).toEqual({
      dueCount: 0,
      reviewingCount: 0,
      graduatedCount: 0,
      nextDueAt: null,
    });
  });

  it('getUpcomingReviewScheduleData(7): srs なし → 空', async () => {
    expect(await q.getUpcomingReviewScheduleData(userId, 7)).toEqual([]);
  });

  // 013-review-item-accuracy: getItemAccuracyData
  it('getItemAccuracyData: 複数 (code, mode) ペアの正解数/総数が実データと一致する', async () => {
    const map = await q.getItemAccuracyData(userId, [
      { municipalityCode: 'T01', mode: 'A' },
      { municipalityCode: 'T02', mode: 'B' },
      { municipalityCode: 'T03', mode: 'A' },
    ]);
    expect(map.get('T01|A')).toEqual({ correct: 1, total: 2 });
    expect(map.get('T02|B')).toEqual({ correct: 1, total: 1 });
    expect(map.get('T03|A')).toEqual({ correct: 2, total: 2 });
  });

  it('getItemAccuracyData: 解答履歴がない (code, mode) はキーとして返らない', async () => {
    const map = await q.getItemAccuracyData(userId, [
      { municipalityCode: 'T01', mode: 'C' }, // T01 の解答履歴は A/B のみ
    ]);
    expect(map.has('T01|C')).toBe(false);
  });

  it('getItemAccuracyData: pairs=[] → 空の Map（クエリ発行なし）', async () => {
    const map = await q.getItemAccuracyData(userId, []);
    expect(map.size).toBe(0);
  });
});
