'use server';

import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import {
  municipalityQuizResults,
  municipalityMaster,
  srsRecords,
} from '@/lib/db/schema';
import { eq, sql, and, lt, count, lte, gt, asc, min } from 'drizzle-orm';
import {
  getJSTToday,
  getJSTDateRange,
  getJSTStartOfToday,
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

function serialize<T>(data: T): T {
  return stripDates(data) as T;
}

async function requireUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

async function getMasterPoolSize(
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

// ──────────────────────────────────────────────────────
// 1. getDashboardSummary
// ──────────────────────────────────────────────────────
export async function getDashboardSummary() {
  const user = await requireUser();
  const userId = user.id;
  const todayStart = getJSTStartOfToday();

  // --- Current (all time) ---
  const [totalRow] = await db
    .select({ value: count() })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, userId));
  const totalQuestions = totalRow.value;

  const [correctRow] = await db
    .select({ value: count() })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        eq(municipalityQuizResults.isCorrect, true),
      ),
    );
  const totalCorrect = correctRow.value;

  const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

  const [studiedRow] = await db
    .select({
      value: sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`,
    })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, userId));
  const studiedCount = studiedRow.value;

  // モード×市区町村のユニーク組み合わせで正解済みカウント
  const [clearedRow] = await db
    .select({
      value: sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`,
    })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        eq(municipalityQuizResults.isCorrect, true),
      ),
    );
  const clearedCount = clearedRow.value;

  const totalSlots = await getMasterPoolSize('all');

  const coverageRate =
    totalSlots > 0 ? clearedCount / totalSlots : 0;

  // --- Prev (before today JST 0:00) ---
  const prevCondition = and(
    eq(municipalityQuizResults.userId, userId),
    lt(municipalityQuizResults.answeredAt, todayStart),
  );

  const [prevTotalRow] = await db
    .select({ value: count() })
    .from(municipalityQuizResults)
    .where(prevCondition);
  const prevTotalQuestions = prevTotalRow.value;

  const [prevCorrectRow] = await db
    .select({ value: count() })
    .from(municipalityQuizResults)
    .where(
      and(prevCondition, eq(municipalityQuizResults.isCorrect, true)),
    );
  const prevTotalCorrect = prevCorrectRow.value;

  const prevOverallAccuracy =
    prevTotalQuestions > 0 ? prevTotalCorrect / prevTotalQuestions : 0;

  const [prevStudiedRow] = await db
    .select({
      value: sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`,
    })
    .from(municipalityQuizResults)
    .where(prevCondition);
  const prevStudiedCount = prevStudiedRow.value;

  const [prevClearedRow] = await db
    .select({
      value: sql<number>`COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode}))`,
    })
    .from(municipalityQuizResults)
    .where(
      and(prevCondition, eq(municipalityQuizResults.isCorrect, true)),
    );
  const prevClearedCount = prevClearedRow.value;

  const prevCoverageRate =
    totalSlots > 0 ? prevClearedCount / totalSlots : 0;

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
// 2. getAccuracyTrend
// ──────────────────────────────────────────────────────
export async function getAccuracyTrend({
  period,
  mode,
  region,
}: {
  period: '7d' | '30d' | 'all';
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const user = await requireUser();
  const userId = user.id;

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
// 2b. getCompletionTrend
// ──────────────────────────────────────────────────────
export async function getCompletionTrend({
  period,
  mode,
  region,
}: {
  period: '7d' | '30d' | 'all';
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const user = await requireUser();
  const userId = user.id;

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
  // Group raw rows by date -> difficulty -> list of (mode, code) entries
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

  // Iterate chronologically, maintaining cumulative Sets per difficulty
  const cumSets: Record<string, Set<string>> = {};
  for (const diff of diffs) cumSets[diff] = new Set();

  const sortedDates = Array.from(dateMap.keys()).sort();

  const dailyData: Record<string, unknown>[] = [];
  for (const dateStr of sortedDates) {
    const diffMap = dateMap.get(dateStr)!;

    // Add new entries to cumulative sets
    for (const diff of diffs) {
      const entries = diffMap.get(diff);
      if (!entries) continue;
      for (const entry of entries) {
        // For mode='all', key by mode:code to track each mode separately
        // For individual mode, just code (mode is already filtered in the query)
        const key = mode === 'all' ? `${entry.mode}:${entry.code}` : entry.code;
        cumSets[diff].add(key);
      }
    }

    // Only output dates within the selected period
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
// 3. getWeaknessRanking
// ──────────────────────────────────────────────────────
export async function getWeaknessRanking() {
  const user = await requireUser();
  const userId = user.id;

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
// 4. getStreak
// ──────────────────────────────────────────────────────
export async function getStreak() {
  const user = await requireUser();
  const userId = user.id;

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

  // Calculate streaks by iterating from most recent date backwards
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  // Check if the most recent date is today or yesterday for current streak
  const mostRecentDate = new Date(dates[0] + 'T00:00:00Z');
  const todayDate = new Date(today + 'T00:00:00Z');
  const diffFromToday =
    (todayDate.getTime() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000);

  // Current streak counts only if the most recent activity is today or yesterday
  const isCurrentStreakActive = diffFromToday <= 1;

  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i] + 'T00:00:00Z');
    const prev = new Date(dates[i - 1] + 'T00:00:00Z');
    const diff = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);

    if (diff === 1) {
      streak++;
    } else {
      if (i === 1 || (i > 1 && currentStreak === 0 && isCurrentStreakActive)) {
        // This was the first break after the most recent date
      }
      if (currentStreak === 0 && isCurrentStreakActive) {
        currentStreak = streak;
      }
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }

  // Handle the final streak
  if (currentStreak === 0 && isCurrentStreakActive) {
    currentStreak = streak;
  }
  longestStreak = Math.max(longestStreak, streak);

  return serialize({ currentStreak, longestStreak, hasPlayedToday });
}

// ──────────────────────────────────────────────────────
// 5. getDifficultyProgress
// ──────────────────────────────────────────────────────
export async function getDifficultyProgress({
  mode,
  region,
}: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const user = await requireUser();
  const userId = user.id;

  const useRegion = region && region !== '全国';
  const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;

  // 1) 難易度別の母数（municipality_master から）
  const whereConditions = [
    sql`${municipalityMaster.difficulty} IN ('easy', 'medium', 'hard', 'expert')`,
  ];
  if (useRegion) {
    whereConditions.push(eq(municipalityMaster.region, region));
  }

  // 全件数（Mode A/D 用）
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

  // (name, prefecture) dedup数（Mode B/C 用）
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
      // A(full) + B(dedup) + C(dedup) + D(full)
      totalMap.set(diff, full * 2 + dedup * 2);
    } else if (mode === 'B' || mode === 'C') {
      totalMap.set(diff, dedup);
    } else {
      totalMap.set(diff, full);
    }
  }

  // 2) 難易度別の正解済みカウント（quiz_results JOIN master）
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
// 5b. getCompletionByMode
// ──────────────────────────────────────────────────────
export async function getCompletionByMode({
  mode,
  region,
}: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const user = await requireUser();
  const userId = user.id;

  const useRegion = region && region !== '全国';

  // JOIN municipality_master to filter by region
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
// 7. getDueReviewSummary — 今日の復習サマリ（SRS 期日駆動）
// ──────────────────────────────────────────────────────
export async function getDueReviewSummary(): Promise<{
  dueCount: number;
  reviewingCount: number;
  graduatedCount: number;
  nextDueAt: string | null;
}> {
  const user = await requireUser();
  const now = new Date();

  const [dueRow, reviewingRow, graduatedRow, nextDueRow] = await Promise.all([
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, user.id), eq(srsRecords.status, 'reviewing'), lte(srsRecords.dueDate, now))),
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, user.id), eq(srsRecords.status, 'reviewing'))),
    db
      .select({ value: count() })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, user.id), eq(srsRecords.status, 'graduated'))),
    db
      .select({ value: min(srsRecords.dueDate) })
      .from(srsRecords)
      .where(and(eq(srsRecords.userId, user.id), eq(srsRecords.status, 'reviewing'), gt(srsRecords.dueDate, now))),
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
// 8. getUpcomingReviewSchedule — 今後 N 日の日別復習予定件数
// ──────────────────────────────────────────────────────
export async function getUpcomingReviewSchedule(days = 7): Promise<Array<{ date: string; count: number }>> {
  const user = await requireUser();
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      date: sql<string>`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`,
      count: sql<number>`CAST(COUNT(*) AS int)`,
    })
    .from(srsRecords)
    .where(
      and(
        eq(srsRecords.userId, user.id),
        eq(srsRecords.status, 'reviewing'),
        gt(srsRecords.dueDate, now),
        lte(srsRecords.dueDate, future),
      ),
    )
    .groupBy(sql`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`)
    .orderBy(asc(sql`DATE(${srsRecords.dueDate} AT TIME ZONE 'Asia/Tokyo')`));

  return rows.map((r) => ({ date: String(r.date), count: Number(r.count) }));
}

// ──────────────────────────────────────────────────────
// 9. getReviewItemList — 復習中（学習途中）のアイテム一覧（ページング+モードフィルタ）
//    メタ認知/進捗の可視化。答え（都道府県）は返さない（流暢性の錯覚を避ける）
// ──────────────────────────────────────────────────────
export async function getReviewItemList(opts?: {
  mode?: 'A' | 'B' | 'C' | 'D';
  limit?: number;
  offset?: number;
}): Promise<{
  items: Array<{ municipalityName: string; mode: string; dueDate: string; repetition: number; interval: number }>;
  total: number;
}> {
  const user = await requireUser();
  const limit = opts?.limit ?? 25;
  const offset = opts?.offset ?? 0;

  const where = and(
    eq(srsRecords.userId, user.id),
    eq(srsRecords.status, 'reviewing'),
    opts?.mode ? eq(srsRecords.mode, opts.mode) : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        municipalityName: srsRecords.municipalityName,
        mode: srsRecords.mode,
        dueDate: srsRecords.dueDate,
        repetition: srsRecords.repetition,
        interval: srsRecords.interval,
      })
      .from(srsRecords)
      .where(where)
      .orderBy(asc(srsRecords.dueDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(srsRecords).where(where),
  ]);

  return {
    items: rows.map((r) => ({
      municipalityName: r.municipalityName,
      mode: r.mode,
      dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate),
      repetition: r.repetition,
      interval: r.interval,
    })),
    total: totalRow[0]?.value ?? 0,
  };
}

// ──────────────────────────────────────────────────────
// 10. getReviewModeBreakdown — モード別の復習中/定着済み件数（glanceable サマリ）
// ──────────────────────────────────────────────────────
export async function getReviewModeBreakdown(): Promise<
  Array<{ mode: 'A' | 'B' | 'C' | 'D'; reviewing: number; graduated: number }>
> {
  const user = await requireUser();

  const rows = await db
    .select({
      mode: srsRecords.mode,
      status: srsRecords.status,
      value: count(),
    })
    .from(srsRecords)
    .where(eq(srsRecords.userId, user.id))
    .groupBy(srsRecords.mode, srsRecords.status);

  const map = new Map<string, { reviewing: number; graduated: number }>();
  for (const m of ['A', 'B', 'C', 'D']) map.set(m, { reviewing: 0, graduated: 0 });
  for (const r of rows) {
    const e = map.get(r.mode) ?? { reviewing: 0, graduated: 0 };
    if (r.status === 'graduated') e.graduated = Number(r.value);
    else if (r.status === 'reviewing') e.reviewing = Number(r.value);
    map.set(r.mode, e);
  }

  return (['A', 'B', 'C', 'D'] as const).map((mode) => ({ mode, ...map.get(mode)! }));
}
