'use server';

import { db } from '@/lib/db';
import { srsRecords, municipalityMaster } from '@/lib/db/schema';
import { eq, and, count, asc } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth/current-user';
import {
  getDashboardSummaryData,
  getAccuracyTrendData,
  getCompletionTrendData,
  getWeaknessRankingData,
  getStreakData,
  getDifficultyProgressData,
  getCompletionByModeData,
  getDueReviewSummaryData,
  getUpcomingReviewScheduleData,
  getItemAccuracyData,
} from './queries';

async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

// 以下の read 系 Server Action は、認証非依存の純粋クエリ（./queries.ts）への
// 薄いラッパ。フィルタ変更・手動更新のオンデマンド取得経路として維持しつつ、
// 初回表示は lib/dashboard/prefetch.ts が認証1回＋Promise.all で同じ関数を呼ぶ。

// 1. getDashboardSummary
export async function getDashboardSummary() {
  const userId = await requireUserId();
  return getDashboardSummaryData(userId);
}

// 2. getAccuracyTrend
export async function getAccuracyTrend(params: {
  period: '7d' | '30d' | 'all';
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const userId = await requireUserId();
  return getAccuracyTrendData(userId, params);
}

// 2b. getCompletionTrend
export async function getCompletionTrend(params: {
  period: '7d' | '30d' | 'all';
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const userId = await requireUserId();
  return getCompletionTrendData(userId, params);
}

// 3. getWeaknessRanking
export async function getWeaknessRanking() {
  const userId = await requireUserId();
  return getWeaknessRankingData(userId);
}

// 4. getStreak
export async function getStreak() {
  const userId = await requireUserId();
  return getStreakData(userId);
}

// 5. getDifficultyProgress
export async function getDifficultyProgress(params: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const userId = await requireUserId();
  return getDifficultyProgressData(userId, params);
}

// 5b. getCompletionByMode
export async function getCompletionByMode(params: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const userId = await requireUserId();
  return getCompletionByModeData(userId, params);
}

// 7. getDueReviewSummary — 今日の復習サマリ（SRS 期日駆動）
export async function getDueReviewSummary() {
  const userId = await requireUserId();
  return getDueReviewSummaryData(userId);
}

// 8. getUpcomingReviewSchedule — 今後 N 日の日別復習予定件数
export async function getUpcomingReviewSchedule(days = 7) {
  const userId = await requireUserId();
  return getUpcomingReviewScheduleData(userId, days);
}

// ──────────────────────────────────────────────────────
// 9. getReviewItemList — 復習中（学習途中）のアイテム一覧（ページング+モードフィルタ）
//    メタ認知/進捗の可視化。答え（都道府県）は返さない（流暢性の錯覚を避ける）
//    ※ 初回ダッシュボード描画には載らない（オンデマンド専用）ため SA に残す。
// ──────────────────────────────────────────────────────
export async function getReviewItemList(opts?: {
  mode?: 'A' | 'B' | 'C' | 'D';
  limit?: number;
  offset?: number;
}): Promise<{
  items: Array<{
    municipalityCode: string;
    municipalityName: string;
    mode: string;
    dueDate: string;
    repetition: number;
    interval: number;
    accuracy?: { correct: number; total: number };
    kana?: string;
  }>;
  total: number;
}> {
  const userId = await requireUserId();
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
      // left join: srsRecords 行は master に対応が無くても必ず残す（total は srsRecords 単独の
      // count のため、innerJoin だと items だけ欠けてページングと不整合になる）。
      // code は municipality_master の PK なので、行が増える(1:多)心配はない。
      .leftJoin(municipalityMaster, eq(srsRecords.municipalityCode, municipalityMaster.code))
      .where(where)
      .orderBy(asc(srsRecords.dueDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(srsRecords).where(where),
  ]);

  // 正答率集計は一覧本体の取得とは独立して行う。失敗しても一覧表示をブロックしない（FR-006）。
  let accuracyMap = new Map<string, { correct: number; total: number }>();
  try {
    const pairs = rows.map((r) => ({ municipalityCode: r.municipalityCode, mode: r.mode }));
    accuracyMap = await getItemAccuracyData(userId, pairs);
  } catch (error) {
    console.error('getReviewItemList: failed to fetch item accuracy data', error);
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
// 10. getReviewModeBreakdown — モード別の復習中/定着済み件数（glanceable サマリ）
//     ※ 初回ダッシュボード描画には載らない（オンデマンド専用）ため SA に残す。
// ──────────────────────────────────────────────────────
export async function getReviewModeBreakdown(): Promise<
  Array<{ mode: 'A' | 'B' | 'C' | 'D'; reviewing: number; graduated: number }>
> {
  const userId = await requireUserId();

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

  return (['A', 'B', 'C', 'D'] as const).map((mode) => ({ mode, ...map.get(mode)! }));
}
