/**
 * 認証非依存の純粋 read クエリ群（userId 引数）。
 * Server Action（actions.ts）とサーバ側プリフェッチの双方から再利用する。
 *
 * 不変条件（data-model.md）: 発行 SQL・集計ロジック・返却 shape・serialize 挙動を
 * 既存 actions.ts と同一に保つ（AC4: 数値一致）。
 */
import { db } from '@/lib/db';
import {
  municipalityQuizResults,
  municipalityMaster,
  srsRecords,
} from '@/lib/db/schema';
import { eq, sql, and, lt, count, gte, asc, min } from 'drizzle-orm';
import {
  getJSTToday,
  getJSTDateRange,
  getJSTStartOfToday,
  getJSTStartOfTomorrow,
} from '@/lib/utils/date-jst';

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

// ──────────────────────────────────────────────────────
// getAccuracyTrendData
// ──────────────────────────────────────────────────────
export async function getAccuracyTrendData(
  userId: string,
  {
    period,
    mode,
    region,
  }: {
    period: '7d' | '30d' | 'all';
    mode: 'all' | 'A' | 'B' | 'C' | 'D';
    region: string;
  },
) {
  const useRegion = region && region !== '全国';
  const periodStart = getJSTDateRange(period);

  const conditions = [eq(municipalityQuizResults.userId, userId)];
  if (periodStart) {
    conditions.push(
      sql`${municipalityQuizResults.answeredAt} >= ${periodStart.toISOString()}::timestamptz`,
    );
  }
  if (mode !== 'all') {
    conditions.push(eq(municipalityQuizResults.mode, mode));
  }
  if (useRegion) {
    conditions.push(eq(municipalityMaster.region, region));
  }

  const query = db
    .select({
      date: sql<string>`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
      difficulty: municipalityMaster.difficulty,
      correctCount: sql<number>`SUM(CASE WHEN ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END)`,
      totalCount: sql<number>`COUNT(*)`,
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    );

  const rows = await query
    .where(and(...conditions))
    .groupBy(
      sql`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
      municipalityMaster.difficulty,
    )
    .orderBy(
      sql`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
    );

  // Pivot: group by date, with per-difficulty accuracy
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  const dateMap = new Map<string, Record<string, { correct: number; total: number }>>();

  for (const r of [...rows]) {
    const d = r.date as unknown;
    const dateStr = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const diff = r.difficulty ?? 'unknown';
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {});
    }
    const entry = dateMap.get(dateStr)!;
    const prev = entry[diff] ?? { correct: 0, total: 0 };
    prev.correct += Number(r.correctCount);
    prev.total += Number(r.totalCount);
    entry[diff] = prev;
  }

  const dailyData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byDiff]) => {
      const row: Record<string, unknown> = { date };
      let allCorrect = 0;
      let allTotal = 0;
      for (const diff of diffs) {
        const d = byDiff[diff];
        if (d) {
          row[diff] = d.total > 0 ? Math.round((d.correct / d.total) * 1000) / 10 : 0;
          allCorrect += d.correct;
          allTotal += d.total;
        } else {
          row[diff] = null;
        }
      }
      row.all = allTotal > 0 ? Math.round((allCorrect / allTotal) * 1000) / 10 : 0;
      row.correctCount = allCorrect;
      row.totalCount = allTotal;
      return row;
    });

  return serialize(dailyData);
}

// ──────────────────────────────────────────────────────
// getCompletionTrendData
// ──────────────────────────────────────────────────────
export async function getCompletionTrendData(
  userId: string,
  {
    period,
    mode,
    region,
  }: {
    period: '7d' | '30d' | 'all';
    mode: 'all' | 'A' | 'B' | 'C' | 'D';
    region: string;
  },
) {
  const useRegion = region && region !== '全国';
  const periodStart = getJSTDateRange(period);

  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;

  // ── Denominator: per-difficulty totals (same logic as getDifficultyProgress) ──
  const masterWhere = [
    sql`${municipalityMaster.difficulty} IN ('easy', 'medium', 'hard', 'expert')`,
  ];
  if (useRegion) {
    masterWhere.push(eq(municipalityMaster.region, region));
  }

  const fullRows = await db
    .select({
      difficulty: municipalityMaster.difficulty,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(municipalityMaster)
    .where(and(...masterWhere))
    .groupBy(municipalityMaster.difficulty);
  const fullMap = new Map(
    [...fullRows].map((r) => [r.difficulty, Number(r.cnt)]),
  );

  const dedupRows = await db
    .select({
      difficulty: municipalityMaster.difficulty,
      cnt: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
    })
    .from(municipalityMaster)
    .where(and(...masterWhere))
    .groupBy(municipalityMaster.difficulty);
  const dedupMap = new Map(
    [...dedupRows].map((r) => [r.difficulty, Number(r.cnt)]),
  );

  const diffTotals: Record<string, number> = {};
  for (const diff of diffs) {
    const full = fullMap.get(diff) ?? 0;
    const dedup = dedupMap.get(diff) ?? 0;
    if (mode === 'all') {
      diffTotals[diff] = full * 2 + dedup * 2;
    } else if (mode === 'B' || mode === 'C') {
      diffTotals[diff] = dedup;
    } else {
      diffTotals[diff] = full;
    }
  }
  const totalAllSlots = Object.values(diffTotals).reduce((a, b) => a + b, 0);

  // ── Numerator: query ALL correct answers (no period filter) for accurate cumulative counts ──
  const conditions = [
    eq(municipalityQuizResults.userId, userId),
    eq(municipalityQuizResults.isCorrect, true),
  ];
  if (mode !== 'all') {
    conditions.push(eq(municipalityQuizResults.mode, mode));
  }
  if (useRegion) {
    conditions.push(eq(municipalityMaster.region, region));
  }

  const rows = await db
    .select({
      date: sql<string>`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
      difficulty: municipalityMaster.difficulty,
      municipalityCode: municipalityQuizResults.municipalityCode,
      mode: municipalityQuizResults.mode,
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    )
    .where(and(...conditions))
    .orderBy(
      sql`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
    );

  // ── Build cumulative distinct counts per difficulty per date ──
  const dateMap = new Map<string, Map<string, Array<{ mode: string; code: string }>>>();
  for (const r of [...rows]) {
    const d = r.date as unknown;
    const dateStr = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const diff = r.difficulty ?? 'unknown';
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, new Map());
    const diffMap = dateMap.get(dateStr)!;
    if (!diffMap.has(diff)) diffMap.set(diff, []);
    diffMap.get(diff)!.push({ mode: r.mode, code: r.municipalityCode });
  }

  const cumSets: Record<string, Set<string>> = {};
  for (const diff of diffs) cumSets[diff] = new Set();

  const sortedDates = Array.from(dateMap.keys()).sort();

  const dailyData: Record<string, unknown>[] = [];
  for (const dateStr of sortedDates) {
    const diffMap = dateMap.get(dateStr)!;

    for (const diff of diffs) {
      const entries = diffMap.get(diff);
      if (!entries) continue;
      for (const entry of entries) {
        const key = mode === 'all' ? `${entry.mode}:${entry.code}` : entry.code;
        cumSets[diff].add(key);
      }
    }

    if (periodStart && dateStr < periodStart.toISOString().slice(0, 10)) {
      continue;
    }

    const row: Record<string, unknown> = { date: dateStr };
    let cumAllCount = 0;
    for (const diff of diffs) {
      const cumCount = cumSets[diff].size;
      const total = diffTotals[diff] ?? 1;
      row[diff] = Math.round((cumCount / total) * 10000) / 100;
      cumAllCount += cumCount;
    }
    row.all = totalAllSlots > 0 ? Math.round((cumAllCount / totalAllSlots) * 10000) / 100 : 0;
    dailyData.push(row);
  }

  return serialize(dailyData);
}

// ──────────────────────────────────────────────────────
// getWeaknessRankingData
// ──────────────────────────────────────────────────────
export async function getWeaknessRankingData(userId: string) {
  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      mode: municipalityQuizResults.mode,
      region: municipalityMaster.region,
      difficulty: municipalityMaster.difficulty,
      totalCount: sql<number>`COUNT(*)`,
      errorCount: sql<number>`SUM(CASE WHEN NOT ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END)`,
      errorRate: sql<number>`SUM(CASE WHEN NOT ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*)`,
    })
    .from(municipalityQuizResults)
    .innerJoin(municipalityMaster, eq(municipalityQuizResults.municipalityCode, municipalityMaster.code))
    .where(eq(municipalityQuizResults.userId, userId))
    .groupBy(
      municipalityQuizResults.municipalityCode,
      municipalityQuizResults.municipalityName,
      municipalityQuizResults.prefecture,
      municipalityQuizResults.mode,
      municipalityMaster.region,
      municipalityMaster.difficulty,
    )
    .having(
      sql`SUM(CASE WHEN NOT ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END) > 0`,
    )
    .orderBy(
      sql`SUM(CASE WHEN NOT ${municipalityQuizResults.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*) DESC`,
      sql`COUNT(*) DESC`,
    )
    .limit(20);

  return serialize(rows.map((r) => ({
    municipalityCode: r.municipalityCode,
    municipalityName: r.municipalityName,
    prefecture: r.prefecture,
    mode: r.mode,
    region: r.region,
    difficulty: r.difficulty,
    totalCount: Number(r.totalCount),
    errorCount: Number(r.errorCount),
    errorRate: Number(r.errorRate),
  })));
}

// ──────────────────────────────────────────────────────
// getStreakData
// ──────────────────────────────────────────────────────
export async function getStreakData(userId: string) {
  const rows = await db
    .select({
      date: sql<string>`DISTINCT DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
    })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, userId))
    .orderBy(
      sql`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') DESC`,
    );

  const dates = [...rows].map((r) => {
    const d = r.date as unknown;
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  });
  const today = getJSTToday();
  const hasPlayedToday = dates.length > 0 && dates[0] === today;

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, hasPlayedToday: false };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  const mostRecentDate = new Date(dates[0] + 'T00:00:00Z');
  const todayDate = new Date(today + 'T00:00:00Z');
  const diffFromToday =
    (todayDate.getTime() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000);

  const isCurrentStreakActive = diffFromToday <= 1;

  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i] + 'T00:00:00Z');
    const prev = new Date(dates[i - 1] + 'T00:00:00Z');
    const diff = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);

    if (diff === 1) {
      streak++;
    } else {
      if (currentStreak === 0 && isCurrentStreakActive) {
        currentStreak = streak;
      }
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }

  if (currentStreak === 0 && isCurrentStreakActive) {
    currentStreak = streak;
  }
  longestStreak = Math.max(longestStreak, streak);

  return serialize({ currentStreak, longestStreak, hasPlayedToday });
}

// ──────────────────────────────────────────────────────
// getDifficultyProgressData
// ──────────────────────────────────────────────────────
export async function getDifficultyProgressData(
  userId: string,
  {
    mode,
    region,
  }: {
    mode: 'all' | 'A' | 'B' | 'C' | 'D';
    region: string;
  },
) {
  const useRegion = region && region !== '全国';
  const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;

  const whereConditions = [
    sql`${municipalityMaster.difficulty} IN ('easy', 'medium', 'hard', 'expert')`,
  ];
  if (useRegion) {
    whereConditions.push(eq(municipalityMaster.region, region));
  }

  const fullRows = await db
    .select({
      difficulty: municipalityMaster.difficulty,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(municipalityMaster)
    .where(and(...whereConditions))
    .groupBy(municipalityMaster.difficulty);
  const fullMap = new Map(
    [...fullRows].map((r) => [r.difficulty, Number(r.cnt)]),
  );

  const dedupRows = await db
    .select({
      difficulty: municipalityMaster.difficulty,
      cnt: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
    })
    .from(municipalityMaster)
    .where(and(...whereConditions))
    .groupBy(municipalityMaster.difficulty);
  const dedupMap = new Map(
    [...dedupRows].map((r) => [r.difficulty, Number(r.cnt)]),
  );

  const totalMap = new Map<string, number>();
  for (const diff of difficulties) {
    const full = fullMap.get(diff) ?? 0;
    const dedup = dedupMap.get(diff) ?? 0;
    if (mode === 'all') {
      totalMap.set(diff, full * 2 + dedup * 2);
    } else if (mode === 'B' || mode === 'C') {
      totalMap.set(diff, dedup);
    } else {
      totalMap.set(diff, full);
    }
  }

  const clearedDistinct = mode === 'all'
    ? sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`
    : sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`;

  const clearedConditions = [
    eq(municipalityQuizResults.userId, userId),
    eq(municipalityQuizResults.isCorrect, true),
  ];
  if (mode !== 'all') {
    clearedConditions.push(eq(municipalityQuizResults.mode, mode));
  }

  const clearedRows = await db
    .select({
      difficulty: municipalityMaster.difficulty,
      clearedCount: clearedDistinct,
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    )
    .where(and(...clearedConditions, ...whereConditions))
    .groupBy(municipalityMaster.difficulty);

  const clearedMap = new Map(
    [...clearedRows].map((r) => [r.difficulty, Number(r.clearedCount)]),
  );

  return serialize(difficulties.map((diff) => {
    const totalCount = totalMap.get(diff) ?? 0;
    const clearedCount = clearedMap.get(diff) ?? 0;
    return {
      difficulty: diff,
      totalCount,
      clearedCount,
      coverageRate: totalCount > 0 ? clearedCount / totalCount : 0,
    };
  }));
}

// ──────────────────────────────────────────────────────
// getCompletionByModeData
// ──────────────────────────────────────────────────────
export async function getCompletionByModeData(
  userId: string,
  {
    mode,
    region,
  }: {
    mode: 'all' | 'A' | 'B' | 'C' | 'D';
    region: string;
  },
) {
  const useRegion = region && region !== '全国';

  const joinCond = eq(municipalityMaster.code, municipalityQuizResults.municipalityCode);

  const conditions: ReturnType<typeof eq>[] = [
    eq(municipalityQuizResults.userId, userId),
    eq(municipalityQuizResults.isCorrect, true),
  ];
  if (mode !== 'all') {
    conditions.push(eq(municipalityQuizResults.mode, mode));
  }

  const distinctExpr = mode === 'all'
    ? sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`
    : sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`;

  const query = db
    .select({ value: distinctExpr })
    .from(municipalityQuizResults);

  let whereClause;
  if (useRegion) {
    query.innerJoin(municipalityMaster, joinCond);
    whereClause = and(...conditions, eq(municipalityMaster.region, region));
  } else {
    whereClause = and(...conditions);
  }

  const [clearedRow] = await query.where(whereClause);
  const clearedCount = Number(clearedRow.value);
  const totalSlots = await getMasterPoolSize(mode, region);

  return serialize({
    clearedCount,
    totalMunicipalities: totalSlots,
    coverageRate: totalSlots > 0 ? clearedCount / totalSlots : 0,
  });
}

// ──────────────────────────────────────────────────────
// getDueReviewSummaryData
// ──────────────────────────────────────────────────────
export async function getDueReviewSummaryData(userId: string): Promise<{
  dueCount: number;
  reviewingCount: number;
  graduatedCount: number;
  nextDueAt: string | null;
}> {
  // due 判定は「今この瞬間」ではなく JST の暦日単位で行う（B013）。
  // 今日中に due になる項目も dueCount に含め、nextDueAt は明日以降の最速 due のみを指す。
  const jstStartOfTomorrow = getJSTStartOfTomorrow();

  const [dueRow, reviewingRow, graduatedRow, nextDueRow] = await Promise.all([
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(
        and(
          eq(srsRecords.userId, userId),
          eq(srsRecords.status, 'reviewing'),
          lt(srsRecords.dueDate, jstStartOfTomorrow),
        ),
      ),
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
  return {
    dueCount: dueRow[0]?.value ?? 0,
    reviewingCount: reviewingRow[0]?.value ?? 0,
    graduatedCount: graduatedRow[0]?.value ?? 0,
    nextDueAt: nextDue instanceof Date ? nextDue.toISOString() : nextDue ? String(nextDue) : null,
  };
}

// ──────────────────────────────────────────────────────
// getUpcomingReviewScheduleData
// ──────────────────────────────────────────────────────
export async function getUpcomingReviewScheduleData(
  userId: string,
  days = 7,
): Promise<Array<{ date: string; count: number }>> {
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
