import { db } from '@/lib/db';
import { srsRecords, municipalityMaster, municipalityQuizResults } from '@/lib/db/schema';
import { eq, and, count, gte, lt, asc, min, inArray, sql } from 'drizzle-orm';
import { getJSTStartOfTomorrow } from '@/lib/utils/date-jst';
import { dueReviewCondition } from '@/lib/db/srs-due';

export interface DueReviewSummaryData {
  dueCount: number;
  reviewingCount: number;
  graduatedCount: number;
  nextDueAt: string | null;
}

export interface UpcomingReviewScheduleEntry {
  date: string;
  count: number;
}

export interface ReviewItemFilterOpts {
  mode?: 'A' | 'B' | 'C' | 'D';
  limit?: number;
  offset?: number;
}

export interface ReviewItem {
  municipalityCode: string;
  municipalityName: string;
  mode: string;
  dueDate: string;
  repetition: number;
  interval: number;
  accuracy?: { correct: number; total: number };
  kana?: string;
}

export interface ReviewItemListResult {
  items: ReviewItem[];
  total: number;
}

export interface ReviewModeBreakdownEntry {
  mode: 'A' | 'B' | 'C' | 'D';
  reviewing: number;
  graduated: number;
}

// ──────────────────────────────────────────────────────
// getItemAccuracyData
// ──────────────────────────────────────────────────────
/**
 * 「覚えている途中の市区町村」一覧（getReviewItemList）の各行（市区町村×モード）
 * について、これまでの全解答試行に対する正答率集計を返す（013-review-item-accuracy）。
 * getWeaknessRankingData と同じ集計パターン（SUM(CASE WHEN is_correct ...)/COUNT(*)）。
 * キーは `${municipalityCode}|${mode}`。解答履歴が1件もない組はキーとして含まれない。
 */
export async function getItemAccuracyData(
  userId: string,
  pairs: { municipalityCode: string; mode: string }[],
): Promise<Map<string, { correct: number; total: number }>> {
  if (pairs.length === 0) return new Map();

  const codes = [...new Set(pairs.map((p) => p.municipalityCode))];

  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      mode: municipalityQuizResults.mode,
      correct: sql<number>`SUM(CASE WHEN ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END)`,
      total: sql<number>`COUNT(*)`,
    })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        inArray(municipalityQuizResults.municipalityCode, codes),
      ),
    )
    .groupBy(municipalityQuizResults.municipalityCode, municipalityQuizResults.mode);

  const map = new Map<string, { correct: number; total: number }>();
  for (const r of rows) {
    map.set(`${r.municipalityCode}|${r.mode}`, {
      correct: Number(r.correct),
      total: Number(r.total),
    });
  }
  return map;
}

// ──────────────────────────────────────────────────────
// getDueReviewSummaryData
// ──────────────────────────────────────────────────────
export async function getDueReviewSummaryData(userId: string): Promise<DueReviewSummaryData> {
  // due 判定は「今この瞬間」ではなく JST の暦日単位で行う（B013）。
  // 今日中に due になる項目も dueCount に含め、nextDueAt は明日以降の最速 due のみを指す。
  const jstStartOfTomorrow = getJSTStartOfTomorrow();

  const [dueRow, reviewingRow, graduatedRow, nextDueRow] = await Promise.all([
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(dueReviewCondition(userId)),
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, userId), eq(srsRecords.status, 'reviewing'))),
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, userId), eq(srsRecords.status, 'graduated'))),
    db
      .select({ value: min(srsRecords.dueDate) })
      .from(srsRecords)
      .where(
        and(
          eq(srsRecords.userId, userId),
          eq(srsRecords.status, 'reviewing'),
          gte(srsRecords.dueDate, jstStartOfTomorrow),
        ),
      ),
  ]);

  const nextDue = nextDueRow[0]?.value;
  let nextDueAt: string | null = null;
  if (nextDue instanceof Date) {
    nextDueAt = nextDue.toISOString();
  } else if (nextDue) {
    nextDueAt = String(nextDue);
  }

  return {
    dueCount: dueRow[0]?.value ?? 0,
    reviewingCount: reviewingRow[0]?.value ?? 0,
    graduatedCount: graduatedRow[0]?.value ?? 0,
    nextDueAt,
  };
}

// ──────────────────────────────────────────────────────
// getUpcomingReviewScheduleData
// ──────────────────────────────────────────────────────
export async function getUpcomingReviewScheduleData(
  userId: string,
  days = 7,
): Promise<UpcomingReviewScheduleEntry[]> {
  // 今日中に due になる項目は getDueReviewSummaryData の dueCount 側に属するため、
  // ここでは明日（JST）以降のみを対象にする（B013: 今日分の二重表示を防ぐ）。
  const jstStartOfTomorrow = getJSTStartOfTomorrow();
  const future = new Date(jstStartOfTomorrow.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      date: sql<string>`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`,
      count: sql<number>`CAST(COUNT(*) AS int)`,
    })
    .from(srsRecords)
    .where(
      and(
        eq(srsRecords.userId, userId),
        eq(srsRecords.status, 'reviewing'),
        gte(srsRecords.dueDate, jstStartOfTomorrow),
        lt(srsRecords.dueDate, future),
      ),
    )
    .groupBy(sql`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`)
    .orderBy(asc(sql`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`));

  return rows.map((r) => ({ date: String(r.date), count: Number(r.count) }));
}

// ──────────────────────────────────────────────────────
// getReviewItemListData
// ──────────────────────────────────────────────────────
export async function getReviewItemListData(
  userId: string,
  opts?: ReviewItemFilterOpts,
): Promise<ReviewItemListResult> {
  const limit = opts?.limit ?? 25;
  const offset = opts?.offset ?? 0;

  const where = and(
    eq(srsRecords.userId, userId),
    eq(srsRecords.status, 'reviewing'),
    opts?.mode ? eq(srsRecords.mode, opts.mode) : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        municipalityCode: srsRecords.municipalityCode,
        municipalityName: srsRecords.municipalityName,
        mode: srsRecords.mode,
        dueDate: srsRecords.dueDate,
        repetition: srsRecords.repetition,
        interval: srsRecords.interval,
        kana: municipalityMaster.kana,
      })
      .from(srsRecords)
      .leftJoin(municipalityMaster, eq(srsRecords.municipalityCode, municipalityMaster.code))
      .where(where)
      .orderBy(asc(srsRecords.dueDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(srsRecords).where(where),
  ]);

  let accuracyMap = new Map<string, { correct: number; total: number }>();
  try {
    const pairs = rows.map((r) => ({ municipalityCode: r.municipalityCode, mode: r.mode }));
    accuracyMap = await getItemAccuracyData(userId, pairs);
  } catch (error) {
    console.error('getReviewItemListData: failed to fetch item accuracy data', error);
  }

  return {
    items: rows.map((r) => ({
      municipalityCode: r.municipalityCode,
      municipalityName: r.municipalityName,
      mode: r.mode,
      dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate),
      repetition: r.repetition,
      interval: r.interval,
      accuracy: accuracyMap.get(`${r.municipalityCode}|${r.mode}`),
      kana: r.kana ?? undefined,
    })),
    total: totalRow[0]?.value ?? 0,
  };
}

// ──────────────────────────────────────────────────────
// getReviewModeBreakdownData
// ──────────────────────────────────────────────────────
export async function getReviewModeBreakdownData(
  userId: string,
): Promise<ReviewModeBreakdownEntry[]> {
  const rows = await db
    .select({
      mode: srsRecords.mode,
      status: srsRecords.status,
      value: count(),
    })
    .from(srsRecords)
    .where(eq(srsRecords.userId, userId))
    .groupBy(srsRecords.mode, srsRecords.status);

  const map = new Map<string, { reviewing: number; graduated: number }>();
  for (const m of ['A', 'B', 'C', 'D']) map.set(m, { reviewing: 0, graduated: 0 });
  for (const r of rows) {
    const e = map.get(r.mode) ?? { reviewing: 0, graduated: 0 };
    if (r.status === 'graduated') e.graduated = Number(r.value);
    else if (r.status === 'reviewing') e.reviewing = Number(r.value);
    map.set(r.mode, e);
  }

  return (['A', 'B', 'C', 'D'] as const).map((mode) => ({
    mode,
    ...(map.get(mode) ?? { reviewing: 0, graduated: 0 }),
  }));
}
