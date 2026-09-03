import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster } from '@/lib/db/schema';
import { eq, sql, and, lt, count } from 'drizzle-orm';
import {
  getJSTToday,
  getJSTDateRange,
  getJSTStartOfToday,
  formatJSTDate,
  toJSTDate,
} from '@/lib/utils/date-jst';
import { calculateStreak } from '@/lib/utils/streak';
import { serialize } from './serialization';
import {
  notSameNameSql,
  notTokyoSpecialWardSql,
  type QuizModeFilter,
  getMasterPoolSize,
  getClearedDistinctSql,
  getFilterCondSql,
} from './sql-helpers';

interface ModeACountResult extends Record<string, unknown> {
  total_a?: number;
  correct_a?: number;
}

async function fetchModeAQuestionCounts(
  userId: string,
  cutoffDate?: Date,
): Promise<{ totalA: number; correctA: number }> {
  const cutoffClause = cutoffDate
    ? sql`AND answered_at < ${cutoffDate.toISOString()}::timestamptz`
    : sql``;

  const result = await db.execute<ModeACountResult>(sql`
    WITH mode_a_events AS (
      SELECT
        answered_at,
        municipality_name,
        is_correct,
        CASE
          WHEN answered_at - LAG(answered_at) OVER (
            PARTITION BY municipality_name ORDER BY answered_at
          ) <= INTERVAL '2 seconds' THEN 0
          ELSE 1
        END AS is_new_group
      FROM municipality_quiz_results
      WHERE user_id = ${userId}::uuid AND mode = 'A' ${cutoffClause}
    ),
    mode_a_groups AS (
      SELECT
        municipality_name,
        is_correct,
        SUM(is_new_group) OVER (
          PARTITION BY municipality_name ORDER BY answered_at
        ) AS group_id
      FROM mode_a_events
    ),
    mode_a_aggregated AS (
      SELECT
        municipality_name,
        group_id,
        bool_and(is_correct) AS is_correct
      FROM mode_a_groups
      GROUP BY municipality_name, group_id
    )
    SELECT
      COALESCE(COUNT(*), 0)::int AS total_a,
      COALESCE(COUNT(*) FILTER (WHERE is_correct), 0)::int AS correct_a
    FROM mode_a_aggregated
  `);

  const rows = Array.from(result);
  const first = rows[0] as { total_a?: number; correct_a?: number } | undefined;
  return {
    totalA: Number(first?.total_a ?? 0),
    correctA: Number(first?.correct_a ?? 0),
  };
}

async function fetchNonAModeCounts(
  userId: string,
  cutoffDate?: Date,
): Promise<{ totalNonA: number; correctNonA: number }> {
  const conditions = [
    eq(municipalityQuizResults.userId, userId),
    sql`${municipalityQuizResults.mode} != 'A'`,
  ];
  if (cutoffDate) {
    conditions.push(lt(municipalityQuizResults.answeredAt, cutoffDate));
  }

  const [row] = await db
    .select({
      total: count(),
      correct: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${municipalityQuizResults.isCorrect} = true), 0)`,
    })
    .from(municipalityQuizResults)
    .where(and(...conditions));

  return {
    totalNonA: Number(row?.total ?? 0),
    correctNonA: Number(row?.correct ?? 0),
  };
}

async function fetchCurrentSummaryCounts(userId: string) {
  return Promise.all([
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

interface SummaryCalculationInput {
  totalA: number;
  correctA: number;
  totalNonA: number;
  correctNonA: number;
  studied: number;
  cleared: number;
  totalSlots: number;
  conquestRateA: number;
  conquestRateD: number;
}

function calculateSummarySnapshot(data: SummaryCalculationInput) {
  const totalQuestions = data.totalNonA + data.totalA;
  const totalCorrect = data.correctNonA + data.correctA;
  const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
  const coverageRate = data.totalSlots > 0 ? data.cleared / data.totalSlots : 0;
  return {
    totalQuestions,
    totalCorrect,
    overallAccuracy,
    studiedCount: data.studied,
    clearedCount: data.cleared,
    totalMunicipalities: data.totalSlots,
    coverageRate,
    conquestRateA: data.conquestRateA,
    conquestRateD: data.conquestRateD,
  };
}

/**
 * ダッシュボード サマリ。認証非依存（userId 引数）。
 */
export async function getDashboardSummaryData(userId: string) {
  const todayStart = getJSTStartOfToday();

  const [
    modeACurrent,
    nonACurrent,
    modeAPrev,
    nonAPrev,
    [studiedRow, clearedRow, totalSlots],
    [prevStudiedRow, prevClearedRow],
    compA,
    prevCompA,
    compD,
    prevCompD,
  ] = await Promise.all([
    fetchModeAQuestionCounts(userId),
    fetchNonAModeCounts(userId),
    fetchModeAQuestionCounts(userId, todayStart),
    fetchNonAModeCounts(userId, todayStart),
    fetchCurrentSummaryCounts(userId),
    fetchPrevSummaryCounts(userId),
    getCompletionByModeData(userId, { mode: 'A', region: '全国' }),
    getCompletionByModeData(userId, { mode: 'A', region: '全国', asOf: todayStart }),
    getCompletionByModeData(userId, { mode: 'D', region: '全国' }),
    getCompletionByModeData(userId, { mode: 'D', region: '全国', asOf: todayStart }),
  ]);

  const current = calculateSummarySnapshot({
    totalA: modeACurrent.totalA,
    correctA: modeACurrent.correctA,
    totalNonA: nonACurrent.totalNonA,
    correctNonA: nonACurrent.correctNonA,
    studied: studiedRow[0].value,
    cleared: clearedRow[0].value,
    totalSlots,
    conquestRateA: compA.coverageRate,
    conquestRateD: compD.coverageRate,
  });

  const prev = calculateSummarySnapshot({
    totalA: modeAPrev.totalA,
    correctA: modeAPrev.correctA,
    totalNonA: nonAPrev.totalNonA,
    correctNonA: nonAPrev.correctNonA,
    studied: prevStudiedRow[0].value,
    cleared: prevClearedRow[0].value,
    totalSlots,
    conquestRateA: prevCompA.coverageRate,
    conquestRateD: prevCompD.coverageRate,
  });

  return serialize({
    ...current,
    prev,
  });
}

type TrendPeriod = '7d' | '30d' | 'all';

function formatAccuracyDateKey(date: Date, period: TrendPeriod): string {
  if (period === 'all') {
    const jst = toJSTDate(date);
    const day = jst.getUTCDay(); // 0: Sun, 1: Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(jst.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const y = monday.getUTCFullYear();
    const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const d = String(monday.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return formatJSTDate(date);
}

function getRepresentativeDifficulty(diffs: (string | null | undefined)[]): string {
  const order = ['easy', 'medium', 'hard', 'expert'];
  let maxIdx = -1;
  let best = 'easy';
  for (const d of diffs) {
    if (!d) continue;
    const idx = order.indexOf(d);
    if (idx > maxIdx) {
      maxIdx = idx;
      best = d;
    }
  }
  return best;
}

interface TrendRowItem {
  answeredAt: Date;
  municipalityName: string;
  mode: string;
  isCorrect: boolean;
  difficulty: string | null;
}

function processModeABuffer(
  buffer: TrendRowItem[],
  period: TrendPeriod,
  onQuestion: (dateKey: string, difficulty: string, isCorrect: boolean) => void,
) {
  if (buffer.length === 0) return;
  const first = buffer[0];
  const dateKey = formatAccuracyDateKey(first.answeredAt, period);
  const isCorrect = buffer.every((b) => b.isCorrect);
  const difficulty = getRepresentativeDifficulty(buffer.map((b) => b.difficulty));
  onQuestion(dateKey, difficulty, isCorrect);
}

function buildTrendDateMap(rows: TrendRowItem[], period: TrendPeriod) {
  const dateMap = new Map<string, Map<string, { correct: number; total: number }>>();

  function addQuestion(dateKey: string, difficulty: string, isCorrect: boolean) {
    let diffMap = dateMap.get(dateKey);
    if (!diffMap) {
      diffMap = new Map();
      dateMap.set(dateKey, diffMap);
    }
    const prev = diffMap.get(difficulty) ?? { correct: 0, total: 0 };
    diffMap.set(difficulty, {
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    });
  }

  let buffer: TrendRowItem[] = [];
  for (const row of rows) {
    if (row.mode === 'A') {
      if (buffer.length > 0) {
        const last = buffer[buffer.length - 1];
        const timeDiffMs = Math.abs(row.answeredAt.getTime() - last.answeredAt.getTime());
        if (row.municipalityName === last.municipalityName && timeDiffMs <= 2000) {
          buffer.push(row);
          continue;
        }
        processModeABuffer(buffer, period, addQuestion);
        buffer = [];
      }
      buffer.push(row);
    } else {
      processModeABuffer(buffer, period, addQuestion);
      buffer = [];
      const dateKey = formatAccuracyDateKey(row.answeredAt, period);
      addQuestion(dateKey, row.difficulty ?? 'easy', row.isCorrect);
    }
  }
  processModeABuffer(buffer, period, addQuestion);
  return dateMap;
}

function formatTrendResult(dateMap: Map<string, Map<string, { correct: number; total: number }>>) {
  const diffs = ['easy', 'medium', 'hard', 'expert'] as const;
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));
  return sortedDates.map((date) => {
    const byDiff = dateMap.get(date);
    let allCorrect = 0;
    let allTotal = 0;
    const entries = diffs.map((diff) => {
      const d = byDiff?.get(diff);
      let val: number | null = null;
      if (d && d.total > 0) {
        val = Math.round((d.correct / d.total) * 1000) / 10;
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
    period: TrendPeriod;
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

  const rows = await db
    .select({
      answeredAt: municipalityQuizResults.answeredAt,
      municipalityName: municipalityQuizResults.municipalityName,
      mode: municipalityQuizResults.mode,
      isCorrect: municipalityQuizResults.isCorrect,
      difficulty: municipalityMaster.difficulty,
    })
    .from(municipalityQuizResults)
    .innerJoin(
      municipalityMaster,
      eq(municipalityMaster.code, municipalityQuizResults.municipalityCode),
    )
    .where(and(...conditions))
    .orderBy(municipalityQuizResults.answeredAt);

  const dateMap = buildTrendDateMap(rows, period);
  return serialize(formatTrendResult(dateMap));
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

export interface WeaknessFilterOpts {
  period?: '7d' | '30d' | 'all';
  mode?: QuizModeFilter;
  region?: string;
}

function buildWeaknessConditions(userId: string, opts?: WeaknessFilterOpts) {
  const period = opts?.period ?? 'all';
  const mode = opts?.mode ?? 'all';
  const region = opts?.region ?? '全国';

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
  return conditions;
}

export async function getWeaknessRankingData(
  userId: string,
  opts?: WeaknessFilterOpts,
) {
  const conditions = buildWeaknessConditions(userId, opts);

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
    .where(and(...conditions))
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

const PROGRESS_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;

interface RepDifficultyCountResult extends Record<string, unknown> {
  rep_difficulty?: string;
  cnt?: number;
}

interface ClearedRepDifficultyResult extends Record<string, unknown> {
  rep_difficulty?: string;
  cleared_cnt?: number;
}

async function fetchModeARepCounts(userId: string, regionCond: ReturnType<typeof sql>) {
  const [denominatorResult, clearedResult] = await Promise.all([
    db.execute<RepDifficultyCountResult>(sql`
      SELECT
        rep_difficulty,
        COUNT(*)::int AS cnt
      FROM (
        SELECT
          name,
          CASE
            WHEN bool_or(difficulty = 'expert') THEN 'expert'
            WHEN bool_or(difficulty = 'hard') THEN 'hard'
            WHEN bool_or(difficulty = 'medium') THEN 'medium'
            ELSE 'easy'
          END AS rep_difficulty
        FROM municipality_master
        WHERE difficulty IN ('easy', 'medium', 'hard', 'expert')
          AND ${notSameNameSql}
          AND ${notTokyoSpecialWardSql}
          ${regionCond}
        GROUP BY name
      ) sub
      GROUP BY rep_difficulty
    `),
    db.execute<ClearedRepDifficultyResult>(sql`
      SELECT
        rep_difficulty,
        COUNT(*)::int AS cleared_cnt
      FROM (
        SELECT
          m.name,
          CASE
            WHEN bool_or(m.difficulty = 'expert') THEN 'expert'
            WHEN bool_or(m.difficulty = 'hard') THEN 'hard'
            WHEN bool_or(m.difficulty = 'medium') THEN 'medium'
            ELSE 'easy'
          END AS rep_difficulty
        FROM municipality_master m
        WHERE m.difficulty IN ('easy', 'medium', 'hard', 'expert')
          AND ${notSameNameSql}
          AND ${notTokyoSpecialWardSql}
          ${regionCond}
          AND m.name IN (
            SELECT DISTINCT r.municipality_name
            FROM municipality_quiz_results r
            WHERE r.user_id = ${userId}::uuid AND r.mode = 'A' AND r.is_correct = true
          )
        GROUP BY m.name
      ) sub
      GROUP BY rep_difficulty
    `),
  ]);

  return { denominatorResult, clearedResult };
}

async function getModeADifficultyProgress(userId: string, region: string, useRegion: boolean) {
  const regionCond = useRegion ? sql`AND ${municipalityMaster.region} = ${region}` : sql``;
  const { denominatorResult, clearedResult } = await fetchModeARepCounts(userId, regionCond);

  const totalMap = new Map<string, number>(
    Array.from(denominatorResult).map((r) => [String(r.rep_difficulty), Number(r.cnt ?? 0)]),
  );
  const clearedMap = new Map<string, number>(
    Array.from(clearedResult).map((r) => [String(r.rep_difficulty), Number(r.cleared_cnt ?? 0)]),
  );

  return PROGRESS_DIFFICULTIES.map((diff) => {
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
  const useRegion = Boolean(region && region !== '全国');
  if (mode === 'A') {
    const items = await getModeADifficultyProgress(userId, region, useRegion);
    return serialize(items);
  }

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

  const items = PROGRESS_DIFFICULTIES.map((diff) => {
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
  params: {
    mode: QuizModeFilter;
    region: string;
    asOf?: Date;
  },
) {
  const { mode, region, asOf } = params;
  const useRegion = region && region !== '全国';

  const conditions: ReturnType<typeof eq>[] = [
    eq(municipalityQuizResults.userId, userId),
    eq(municipalityQuizResults.isCorrect, true),
  ];
  if (asOf) {
    conditions.push(lt(municipalityQuizResults.answeredAt, asOf));
  }
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
  const clearedCount = Number(clearedRow?.value ?? 0);
  const totalSlots = await getMasterPoolSize(mode, region);

  return serialize({
    clearedCount,
    totalMunicipalities: totalSlots,
    coverageRate: totalSlots > 0 ? clearedCount / totalSlots : 0,
  });
}
