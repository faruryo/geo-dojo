/**
 * 認証非依存の純粋 read クエリ群（userId 引数）。
 * Server Action（actions.ts）とサーバ側プリフェッチの双方から再利用する。
 *
 * 不変条件（data-model.md）: 発行 SQL・集計ロジック・返却 shape・serialize 挙動を
 * 既存 actions.ts と同一に保つ（AC4: 数値一致）。
 */
import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster } from '@/lib/db/schema';
import { eq, sql, and, lt, count } from 'drizzle-orm';
import { getJSTStartOfToday } from '@/lib/utils/date-jst';

function stripDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(stripDates);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = stripDates(v);
    }
    return result;
  }
  return obj;
}

export function serialize<T>(data: T): T {
  return stripDates(data) as T;
}

export async function getMasterPoolSize(
  mode: 'all' | 'A' | 'B' | 'C' | 'D',
  region?: string,
): Promise<number> {
  const regionCond = region && region !== '全国'
    ? sql`${municipalityMaster.region} = ${region}`
    : undefined;

  if (mode === 'B' || mode === 'C') {
    const [row] = await db
      .select({
        value: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
      })
      .from(municipalityMaster)
      .where(regionCond);
    return Number(row.value);
  }

  const [row] = await db
    .select({ value: count() })
    .from(municipalityMaster)
    .where(regionCond);
  const total = row.value;

  if (mode === 'all') {
    const [dedupRow] = await db
      .select({
        value: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
      })
      .from(municipalityMaster)
      .where(regionCond);
    const deduped = Number(dedupRow.value);
    return total * 2 + deduped * 2;
  }

  return total;
}

/**
 * ダッシュボード サマリ。認証非依存（userId 引数）。
 * 相互依存のない全クエリを Promise.all で並列実行する（totalSlots を含め全て独立。
 * 各値は最後の算術でのみ使用するため順序依存なし）。
 */
export async function getDashboardSummaryData(userId: string) {
  const todayStart = getJSTStartOfToday();

  const prevCondition = and(
    eq(municipalityQuizResults.userId, userId),
    lt(municipalityQuizResults.answeredAt, todayStart),
  );

  const [
    totalRow,
    correctRow,
    studiedRow,
    clearedRow,
    totalSlots,
    prevTotalRow,
    prevCorrectRow,
    prevStudiedRow,
    prevClearedRow,
  ] = await Promise.all([
    // --- Current (all time) ---
    db
      .select({ value: count() })
      .from(municipalityQuizResults)
      .where(eq(municipalityQuizResults.userId, userId)),
    db
      .select({ value: count() })
      .from(municipalityQuizResults)
      .where(
        and(
          eq(municipalityQuizResults.userId, userId),
          eq(municipalityQuizResults.isCorrect, true),
        ),
      ),
    db
      .select({
        value: sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`,
      })
      .from(municipalityQuizResults)
      .where(eq(municipalityQuizResults.userId, userId)),
    // モード×市区町村のユニーク組み合わせで正解済みカウント
    db
      .select({
        value: sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`,
      })
      .from(municipalityQuizResults)
      .where(
        and(
          eq(municipalityQuizResults.userId, userId),
          eq(municipalityQuizResults.isCorrect, true),
        ),
      ),
    getMasterPoolSize('all'),
    // --- Prev (before today JST 0:00) ---
    db
      .select({ value: count() })
      .from(municipalityQuizResults)
      .where(prevCondition),
    db
      .select({ value: count() })
      .from(municipalityQuizResults)
      .where(and(prevCondition, eq(municipalityQuizResults.isCorrect, true))),
    db
      .select({
        value: sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`,
      })
      .from(municipalityQuizResults)
      .where(prevCondition),
    db
      .select({
        value: sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`,
      })
      .from(municipalityQuizResults)
      .where(and(prevCondition, eq(municipalityQuizResults.isCorrect, true))),
  ]);

  const totalQuestions = totalRow[0].value;
  const totalCorrect = correctRow[0].value;
  const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
  const studiedCount = studiedRow[0].value;
  const clearedCount = clearedRow[0].value;
  const coverageRate = totalSlots > 0 ? clearedCount / totalSlots : 0;

  const prevTotalQuestions = prevTotalRow[0].value;
  const prevTotalCorrect = prevCorrectRow[0].value;
  const prevOverallAccuracy =
    prevTotalQuestions > 0 ? prevTotalCorrect / prevTotalQuestions : 0;
  const prevStudiedCount = prevStudiedRow[0].value;
  const prevClearedCount = prevClearedRow[0].value;
  const prevCoverageRate = totalSlots > 0 ? prevClearedCount / totalSlots : 0;

  return serialize({
    totalQuestions,
    totalCorrect,
    overallAccuracy,
    studiedCount,
    clearedCount,
    totalMunicipalities: totalSlots,
    coverageRate,
    prev: {
      totalQuestions: prevTotalQuestions,
      totalCorrect: prevTotalCorrect,
      overallAccuracy: prevOverallAccuracy,
      studiedCount: prevStudiedCount,
      clearedCount: prevClearedCount,
      totalMunicipalities: totalSlots,
      coverageRate: prevCoverageRate,
    },
  });
}
