import { db } from '@/lib/db';
import { municipalityMaster, municipalityQuizResults } from '@/lib/db/schema';
import { sql, and, count } from 'drizzle-orm';

export type QuizModeFilter = 'all' | 'A' | 'B' | 'C' | 'D';

export const notSameNameSql = sql`NOT (REGEXP_REPLACE(${municipalityMaster.name}, '[市区町村]$', '') = REGEXP_REPLACE(${municipalityMaster.prefecture}, '[都道府県]$', ''))`;

/** Mode A 出題から除外する東京23区（filterTextModeMunicipalities と揃える） */
export const notTokyoSpecialWardSql = sql`NOT (${municipalityMaster.prefecture} = '東京都' AND ${municipalityMaster.name} LIKE '%区')`;

export async function getMasterPoolSize(
  mode: QuizModeFilter,
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
      .where(and(regionCond, notSameNameSql));
    return Number(row.value);
  }

  if (mode === 'A') {
    const [row] = await db
      .select({
        value: sql<number>`COUNT(DISTINCT ${municipalityMaster.name})`,
      })
      .from(municipalityMaster)
      .where(and(regionCond, notSameNameSql, notTokyoSpecialWardSql));
    return Number(row.value);
  }

  if (mode === 'D') {
    const [row] = await db
      .select({ value: count() })
      .from(municipalityMaster)
      .where(regionCond);
    return row.value;
  }

  if (mode === 'all') {
    const [rowA] = await db
      .select({
        value: sql<number>`COUNT(DISTINCT ${municipalityMaster.name})`,
      })
      .from(municipalityMaster)
      .where(and(regionCond, notSameNameSql));
    
    const [rowBC] = await db
      .select({
        value: sql<number>`COUNT(DISTINCT (${municipalityMaster.name} || '::' || ${municipalityMaster.prefecture}))`,
      })
      .from(municipalityMaster)
      .where(and(regionCond, notSameNameSql));
    
    const [rowD] = await db
      .select({ value: count() })
      .from(municipalityMaster)
      .where(regionCond);

    return Number(rowA.value) + Number(rowBC.value) * 2 + Number(rowD.value);
  }

  return 0;
}

export function getClearedDistinctSql(mode: QuizModeFilter) {
  if (mode === 'all') {
    return sql<number>`
      COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityCode})) FILTER (WHERE ${municipalityQuizResults.mode} = 'D'), 0)
      + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName})) FILTER (WHERE ${municipalityQuizResults.mode} = 'A'), 0)
      + COALESCE(COUNT(DISTINCT (${municipalityQuizResults.mode} || ':' || ${municipalityQuizResults.municipalityName} || '::' || ${municipalityQuizResults.prefecture})) FILTER (WHERE ${municipalityQuizResults.mode} = 'B' OR ${municipalityQuizResults.mode} = 'C'), 0)
    `;
  }
  if (mode === 'A') {
    return sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityName})`;
  }
  if (mode === 'B' || mode === 'C') {
    return sql<number>`COUNT(DISTINCT (${municipalityQuizResults.municipalityName} || '::' || ${municipalityQuizResults.prefecture}))`;
  }
  return sql<number>`COUNT(DISTINCT ${municipalityQuizResults.municipalityCode})`;
}

export function getFilterCondSql(mode: QuizModeFilter) {
  if (mode === 'all') {
    return sql`(${municipalityQuizResults.mode} = 'D' OR ${notSameNameSql})`;
  }
  if (mode === 'A' || mode === 'B' || mode === 'C') {
    if (mode === 'A') {
      return sql`(${notSameNameSql} AND ${notTokyoSpecialWardSql})`;
    }
    return notSameNameSql;
  }
  return undefined;
}
