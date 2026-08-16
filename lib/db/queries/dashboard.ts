import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster } from '@/lib/db/schema';
import { eq, sql, and, lt, count } from 'drizzle-orm';
import {
  getJSTToday,
  getJSTDateRange,
  getJSTStartOfToday,
} from '@/lib/utils/date-jst';
import { calculateStreak } from '@/lib/utils/streak';
import { serialize } from './serialization';
import {
  notSameNameSql,
  type QuizModeFilter,
  getMasterPoolSize,
  getClearedDistinctSql,
  getFilterCondSql,
} from './sql-helpers';

async function fetchCurrentSummaryCounts(userId: string) {
  return Promise.all([
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
    db
      .select({
        value: sql<number>`
          COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode})) FILTER (WHERE ${municipalityQuizResults.mode} = 'D'), 0)
          + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName})) FILTER (WHERE ${municipalityQuizResults.mode} = 'A' AND ${notSameNameSql}), 0)
          + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName} || '::' || ${municipalityQuizResults.prefecture})) FILTER (WHERE (${municipalityQuizResults.mode} = 'B' OR ${municipalityQuizResults.mode} = 'C') AND ${notSameNameSql}), 0)
        `,
      })
      .from(municipalityQuizResults)
      .innerJoin(municipalityMaster, eq(municipalityMaster.code, municipalityQuizResults.municipalityCode))
      .where(
        and(
          eq(municipalityQuizResults.userId, userId),
          eq(municipalityQuizResults.isCorrect, true),
        ),
      ),
    getMasterPoolSize('all'),
  ]);
}

async function fetchPrevSummaryCounts(userId: string) {
  const todayStart = getJSTStartOfToday();
  const prevCondition = and(
    eq(municipalityQuizResults.userId, userId),
    lt(municipalityQuizResults.answeredAt, todayStart),
  );

  return Promise.all([
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
        value: sql<number>`
          COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode})) FILTER (WHERE ${municipalityQuizResults.mode} = 'D'), 0)
          + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName})) FILTER (WHERE ${municipalityQuizResults.mode} = 'A' AND ${notSameNameSql}), 0)
          + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName} || '::' || ${municipalityQuizResults.prefecture})) FILTER (WHERE (${municipalityQuizResults.mode} = 'B' OR ${municipalityQuizResults.mode} = 'C') AND ${notSameNameSql}), 0)
        `,
      })
      .from(municipalityQuizResults)
      .innerJoin(municipalityMaster, eq(municipalityMaster.code, municipalityQuizResults.municipalityCode))
      .where(and(prevCondition, eq(municipalityQuizResults.isCorrect, true))),
  ]);
}

/**
 * ダッシュボード サマリ。認証非依存（userId 引数）。
 */
export async function getDashboardSummaryData(userId: string) {
  const [
    [totalRow, correctRow, studiedRow, clearedRow, totalSlots],
    [prevTotalRow, prevCorrectRow, prevStudiedRow, prevClearedRow],
  ] = await Promise.all([
    fetchCurrentSummaryCounts(userId),
    fetchPrevSummaryCounts(userId),
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

interface RawAccuracyRow {
  date: unknown;
  difficulty: string | null;
  correctCount: number;
  totalCount: number;
}

function aggregateAccuracyByDate(rows: RawAccuracyRow[]) {
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  const dateMap = new Map<string, Map<string, { correct: number; total: number }>>();

  for (const r of rows) {
    const d = r.date;
    const dateStr = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const diff = r.difficulty ?? 'unknown';

    let diffMap = dateMap.get(dateStr);
    if (!diffMap) {
      diffMap = new Map();
      dateMap.set(dateStr, diffMap);
    }
    const prev = diffMap.get(diff) ?? { correct: 0, total: 0 };
    diffMap.set(diff, {
      correct: prev.correct + Number(r.correctCount),
      total: prev.total + Number(r.totalCount),
    });
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byDiff]) => {
      let allCorrect = 0;
      let allTotal = 0;
      const entries = diffs.map((diff) => {
        const d = byDiff.get(diff);
        let val: number | null = null;
        if (d) {
          val = d.total > 0 ? Math.round((d.correct / d.total) * 1000) / 10 : 0;
          allCorrect += d.correct;
          allTotal += d.total;
        }
        return [diff, val] as const;
      });

      const row: Record<string, unknown> = Object.fromEntries(entries);
      row.date = date;
      row.all = allTotal > 0 ? Math.round((allCorrect / allTotal) * 1000) / 10 : 0;
      row.correctCount = allCorrect;
      row.totalCount = allTotal;
      return row;
    });
}

export async function getAccuracyTrendData(
  userId: string,
  {
    period,
    mode,
    region,
  }: {
    period: '7d' | '30d' | 'all';
    mode: QuizModeFilter;
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

  return serialize(aggregateAccuracyByDate(rows));
}

function calculateDiffTotals(
  mode: QuizModeFilter,
  fullMap: Map<string, { cnt: number; cntExcluded: number; cntDistinctExcluded: number }>,
  dedupMap: Map<string, { cnt: number; cntExcluded: number }>,
) {
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  const diffTotals = new Map<string, number>();

  for (const diff of diffs) {
    const full = fullMap.get(diff) ?? { cnt: 0, cntExcluded: 0, cntDistinctExcluded: 0 };
    const dedup = dedupMap.get(diff) ?? { cnt: 0, cntExcluded: 0 };
    if (mode === 'all') {
      diffTotals.set(diff, full.cntDistinctExcluded + dedup.cntExcluded * 2 + full.cnt);
    } else if (mode === 'B' || mode === 'C') {
      diffTotals.set(diff, dedup.cntExcluded);
    } else if (mode === 'A') {
      diffTotals.set(diff, full.cntDistinctExcluded);
    } else {
      diffTotals.set(diff, full.cnt);
    }
  }

  const totalAllSlots = Array.from(diffTotals.values()).reduce((a, b) => a + b, 0);
  return { diffTotals, totalAllSlots };
}

async function fetchCompletionDenominators(
  mode: QuizModeFilter,
  useRegion: boolean,
  region: string,
) {
  const masterWhere = [
    sql`${municipalityMaster.difficulty} IN ('easy', 'medium', 'hard', 'expert')`,
  ];
  if (useRegion) {
    masterWhere.push(eq(municipalityMaster.region, region));
  }

  const [fullRows, dedupRows] = await Promise.all([
    db
      .select({
        difficulty: municipalityMaster.difficulty,
        cnt: sql<number>`COUNT(*)`,
        cntExcluded: sql<number>`COUNT(*) FILTER (WHERE ${notSameNameSql})`,
        cntDistinctExcluded: sql<number>`COUNT(DISTINCT ${municipalityMaster.name}) FILTER (WHERE ${notSameNameSql})`,
      })
      .from(municipalityMaster)
      .where(and(...masterWhere))
      .groupBy(municipalityMaster.difficulty),
    db
      .select({
        difficulty: municipalityMaster.difficulty,
        cnt: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
        cntExcluded: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture})) FILTER (WHERE ${notSameNameSql})`,
      })
      .from(municipalityMaster)
      .where(and(...masterWhere))
      .groupBy(municipalityMaster.difficulty),
  ]);

  const fullMap = new Map(
    [...fullRows].map((r) => [
      r.difficulty,
      {
        cnt: Number(r.cnt),
        cntExcluded: Number(r.cntExcluded),
        cntDistinctExcluded: Number(r.cntDistinctExcluded),
      },
    ]),
  );
  const dedupMap = new Map(
    [...dedupRows].map((r) => [r.difficulty, { cnt: Number(r.cnt), cntExcluded: Number(r.cntExcluded) }]),
  );

  return calculateDiffTotals(mode, fullMap, dedupMap);
}

interface RawCompletionRow {
  date: unknown;
  difficulty: string | null;
  municipalityCode: string;
  municipalityName: string | null;
  prefecture: string | null;
  mode: string;
}

function getCompletionEntryKey(
  mode: QuizModeFilter,
  entry: { mode: string; code: string; name: string; prefecture: string },
) {
  if (mode === 'all') {
    if (entry.mode === 'A') return `A:${entry.name}`;
    if (entry.mode === 'B' || entry.mode === 'C') return `${entry.mode}:${entry.name}::${entry.prefecture}`;
    return `D:${entry.code}`;
  }
  if (mode === 'A') return entry.name;
  if (mode === 'B' || mode === 'C') return `${entry.name}::${entry.prefecture}`;
  return entry.code;
}

function updateCumSets(
  diffMap: Map<string, Array<{ mode: string; code: string; name: string; prefecture: string }>>,
  cumSets: Map<string, Set<string>>,
  mode: QuizModeFilter,
) {
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  for (const diff of diffs) {
    const entries = diffMap.get(diff);
    if (!entries) continue;
    const set = cumSets.get(diff);
    if (set) {
      for (const entry of entries) {
        set.add(getCompletionEntryKey(mode, entry));
      }
    }
  }
}

function buildCompletionDailyTrend(
  rows: RawCompletionRow[],
  mode: QuizModeFilter,
  diffTotals: Map<string, number>,
  totalAllSlots: number,
  periodStart: Date | null,
) {
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  const dateMap = new Map<string, Map<string, Array<{ mode: string; code: string; name: string; prefecture: string }>>>();

  for (const r of rows) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    const diff = r.difficulty ?? 'unknown';

    let diffMap = dateMap.get(dateStr);
    if (!diffMap) {
      diffMap = new Map();
      dateMap.set(dateStr, diffMap);
    }
    let list = diffMap.get(diff);
    if (!list) {
      list = [];
      diffMap.set(diff, list);
    }
    list.push({
      mode: r.mode,
      code: r.municipalityCode,
      name: r.municipalityName || '',
      prefecture: r.prefecture || '',
    });
  }

  const cumSets = new Map<string, Set<string>>(diffs.map((d) => [d, new Set()]));
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));
  const dailyData: Record<string, unknown>[] = [];

  for (const dateStr of sortedDates) {
    const diffMap = dateMap.get(dateStr);
    if (diffMap) {
      updateCumSets(diffMap, cumSets, mode);
    }

    if (periodStart && dateStr < periodStart.toISOString().slice(0, 10)) {
      continue;
    }

    let cumAllCount = 0;
    const rowValues = diffs.map((diff) => {
      const set = cumSets.get(diff);
      const cumCount = set ? set.size : 0;
      const total = diffTotals.get(diff) ?? 1;
      const val = Math.round((cumCount / total) * 10000) / 100;
      cumAllCount += cumCount;
      return [diff, val] as const;
    });

    const row: Record<string, unknown> = Object.fromEntries(rowValues);
    row.date = dateStr;
    row.all = totalAllSlots > 0 ? Math.round((cumAllCount / totalAllSlots) * 10000) / 100 : 0;
    dailyData.push(row);
  }

  return dailyData;
}

export async function getCompletionTrendData(
  userId: string,
  {
    period,
    mode,
    region,
  }: {
    period: '7d' | '30d' | 'all';
    mode: QuizModeFilter;
    region: string;
  },
) {
  const useRegion = region && region !== '全国';
  const periodStart = getJSTDateRange(period);

  const { diffTotals, totalAllSlots } = await fetchCompletionDenominators(mode, Boolean(useRegion), region);

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

  let filterCond;
  if (mode === 'all') {
    filterCond = sql`(${municipalityQuizResults.mode} = 'D' OR ${notSameNameSql})`;
  } else if (mode === 'A' || mode === 'B' || mode === 'C') {
    filterCond = notSameNameSql;
  }

  const rows = await db
    .select({
      date: sql<string>`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
      difficulty: municipalityMaster.difficulty,
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      mode: municipalityQuizResults.mode,
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    )
    .where(and(...conditions, filterCond))
    .orderBy(
      sql`DATE(${municipalityQuizResults.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')`,
    );

  return serialize(
    buildCompletionDailyTrend(rows, mode, diffTotals, totalAllSlots, periodStart),
  );
}

export async function getWeaknessRankingData(userId: string) {
  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      mode: municipalityQuizResults.mode,
      region: municipalityMaster.region,
      difficulty: municipalityMaster.difficulty,
      kana: municipalityMaster.kana,
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
      municipalityMaster.kana,
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
    kana: r.kana ?? undefined,
    totalCount: Number(r.totalCount),
    errorCount: Number(r.errorCount),
    errorRate: Number(r.errorRate),
  })));
}

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
  const streakResult = calculateStreak(dates, today);

  return serialize({
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak,
    hasPlayedToday: streakResult.hasPlayedToday,
  });
}

export async function getDifficultyProgressData(
  userId: string,
  {
    mode,
    region,
  }: {
    mode: QuizModeFilter;
    region: string;
  },
) {
  const useRegion = region && region !== '全国';
  const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;

  const { diffTotals } = await fetchCompletionDenominators(mode, Boolean(useRegion), region);
  const totalMap = diffTotals;

  const whereConditions = [
    sql`${municipalityMaster.difficulty} IN ('easy', 'medium', 'hard', 'expert')`,
  ];
  if (useRegion) {
    whereConditions.push(eq(municipalityMaster.region, region));
  }

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
      clearedCount: getClearedDistinctSql(mode),
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    )
    .where(and(...clearedConditions, ...whereConditions, getFilterCondSql(mode)))
    .groupBy(municipalityMaster.difficulty);

  const clearedMap = new Map<string, number>(
    [...clearedRows].map((r) => [String(r.difficulty), Number(r.clearedCount)]),
  );

  const items = difficulties.map((diff) => {
    const totalCount = totalMap.get(diff) ?? 0;
    const clearedCount = clearedMap.get(diff) ?? 0;
    const rate = totalCount > 0 ? clearedCount / totalCount : 0;
    return {
      difficulty: diff,
      clearedCount,
      totalCount,
      rate,
      coverageRate: rate,
    };
  });

  return serialize(items);
}

export async function getCompletionByModeData(
  userId: string,
  {
    mode,
    region,
  }: {
    mode: QuizModeFilter;
    region: string;
  },
) {
  const useRegion = region && region !== '全国';

  const conditions: ReturnType<typeof eq>[] = [
    eq(municipalityQuizResults.userId, userId),
    eq(municipalityQuizResults.isCorrect, true),
  ];
  if (mode !== 'all') {
    conditions.push(eq(municipalityQuizResults.mode, mode));
  }

  const query = db
    .select({ value: getClearedDistinctSql(mode) })
    .from(municipalityQuizResults)
    .innerJoin(municipalityMaster, eq(municipalityMaster.code, municipalityQuizResults.municipalityCode));

  const filterCond = getFilterCondSql(mode);
  const regionCond = useRegion ? eq(municipalityMaster.region, region) : undefined;

  const [clearedRow] = await query.where(and(...conditions, filterCond, regionCond));
  const clearedCount = Number(clearedRow.value);
  const totalSlots = await getMasterPoolSize(mode, region);

  return serialize({
    clearedCount,
    totalMunicipalities: totalSlots,
    coverageRate: totalSlots > 0 ? clearedCount / totalSlots : 0,
  });
}
