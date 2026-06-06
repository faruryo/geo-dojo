'use server';

import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster, srsRecords, type MunicipalityMaster } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { computeSrsUpdate } from '@/lib/quiz/srs/update';
import type { SrsStatus } from '@/lib/quiz/srs/types';
import { inferSessions, computeCellAccuracies, computeCellCoverages } from '@/lib/quiz/recommendation/cell-stats';
import { extractFitZone } from '@/lib/quiz/recommendation/fit-zone';
import { generateRecommendation } from '@/lib/quiz/recommendation/engine';
import type { LearnerState, Recommendation } from '@/lib/quiz/recommendation/types';

// Lazy-loaded municipality validation set (loaded once, reused across warm invocations).
// NOTE: 以前は public/municipalities.json を fs で読んでいたが、Vercel の serverless
// 関数バンドル(/var/task)に public/ の静的アセットは含まれず ENOENT で全保存が 500 に
// なっていた。DB の municipality_master（クライアントの出題元と同一の信頼できる情報源）を
// 参照することで実行時のファイル依存を排除する。
let _validCodes: Set<string> | null = null;

async function getValidCodes(): Promise<Set<string>> {
  if (_validCodes) return _validCodes;
  const rows = await db.select({ code: municipalityMaster.code }).from(municipalityMaster);
  _validCodes = new Set(rows.map((m) => m.code));
  return _validCodes;
}

// In-memory rate limiter: 60 req/min per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) {
    console.warn('[rate-limit] municipality quiz rate exceeded', { userId });
    return false;
  }
  entry.count++;
  return true;
}

export async function saveMunicipalityQuizResult(input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
}): Promise<void> {
  // 本番では Next.js が server action の throw を digest に隠すため、原因を必ず明示ログしてから
  // 再 throw する。クライアントは Promise.allSettled で握り潰すので、ここが唯一の検知点になる。
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Unauthorized');

    if (!checkRateLimit(user.id)) throw new Error('Rate limit exceeded');

    // Whitelist validate mode
    if (!['A', 'B', 'C', 'D'].includes(input.mode)) throw new Error('Invalid mode');

    // Validate municipality code against master data
    if (!(await getValidCodes()).has(input.municipalityCode)) throw new Error('Invalid municipality code');

    // Strict boolean check
    if (typeof input.isCorrect !== 'boolean') throw new Error('Invalid isCorrect');

    await db.insert(municipalityQuizResults).values({
      userId: user.id,
      municipalityCode: input.municipalityCode,
      municipalityName: input.municipalityName,
      prefecture: input.prefecture,
      mode: input.mode,
      isCorrect: input.isCorrect,
    });

    // SM-2 更新（全クイズ共通: 復習セッション・通常クイズ双方）
    await upsertSrsRecord(user.id, input);
  } catch (e) {
    console.error('[saveMunicipalityQuizResult] failed', {
      code: input.municipalityCode,
      mode: input.mode,
      isCorrect: input.isCorrect,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    throw e;
  }
}

async function upsertSrsRecord(
  userId: string,
  input: { municipalityCode: string; municipalityName: string; prefecture: string; mode: string; isCorrect: boolean },
): Promise<void> {
  const now = new Date();

  const [existing] = await db
    .select()
    .from(srsRecords)
    .where(
      and(
        eq(srsRecords.userId, userId),
        eq(srsRecords.municipalityCode, input.municipalityCode),
        eq(srsRecords.mode, input.mode),
      ),
    )
    .limit(1);

  const action = computeSrsUpdate(
    existing
      ? {
          easeFactor: existing.easeFactor,
          repetition: existing.repetition,
          interval: existing.interval,
          status: existing.status as SrsStatus,
          lastReviewedAt: existing.lastReviewedAt,
        }
      : null,
    input.isCorrect,
    now,
  );

  if (action.kind === 'skip') return;

  await db
    .insert(srsRecords)
    .values({
      userId,
      municipalityCode: input.municipalityCode,
      municipalityName: input.municipalityName,
      prefecture: input.prefecture,
      mode: input.mode,
      easeFactor: action.easeFactor,
      repetition: action.repetition,
      interval: action.interval,
      dueDate: action.dueDate,
      lastReviewedAt: action.lastReviewedAt,
      status: action.status,
    })
    .onConflictDoUpdate({
      target: [srsRecords.userId, srsRecords.municipalityCode, srsRecords.mode],
      set: {
        easeFactor: action.easeFactor,
        repetition: action.repetition,
        interval: action.interval,
        dueDate: action.dueDate,
        lastReviewedAt: action.lastReviewedAt,
        status: action.status,
      },
    });
}

export async function getMunicipalityWeakness(): Promise<
  Array<{ municipalityCode: string; municipalityName: string; prefecture: string; errorRate: number }>
> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      total: sql<number>`CAST(COUNT(*) AS int)`,
      wrong: sql<number>`CAST(COUNT(*) FILTER (WHERE NOT ${municipalityQuizResults.isCorrect}) AS int)`,
    })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, user.id))
    .groupBy(
      municipalityQuizResults.municipalityCode,
      municipalityQuizResults.municipalityName,
      municipalityQuizResults.prefecture,
    )
    .limit(200);

  return rows
    .map((r) => ({
      municipalityCode: r.municipalityCode,
      municipalityName: r.municipalityName,
      prefecture: r.prefecture,
      errorRate: r.total > 0 ? r.wrong / r.total : 0,
    }))
    .filter((r) => r.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 100);
}

export async function getMunicipalityMaster(): Promise<MunicipalityMaster[]> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  return db.select().from(municipalityMaster);
}

type GetRecommendationInput = {
  excludeCodes?: string[];
  clientNowIso?: string;
};

async function buildLearnerState(userId: string): Promise<{
  state: LearnerState;
  allMaster: Array<{ code: string; name: string; prefecture: string; region: string; difficulty: string }>;
}> {
  const [allResults, allMasterRows, crowdRows] = await Promise.all([
    db
      .select()
      .from(municipalityQuizResults)
      .where(eq(municipalityQuizResults.userId, userId))
      .orderBy(municipalityQuizResults.answeredAt),
    db.select().from(municipalityMaster),
    db
      .select({
        difficulty: municipalityMaster.difficulty,
        correctCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${municipalityQuizResults.isCorrect}) AS int)`,
        totalCount: sql<number>`CAST(COUNT(*) AS int)`,
      })
      .from(municipalityQuizResults)
      .innerJoin(municipalityMaster, eq(municipalityQuizResults.municipalityCode, municipalityMaster.code))
      .groupBy(municipalityMaster.difficulty),
  ]);

  const masterMap = new Map(allMasterRows.map((m) => [m.code, m]));

  const crowdAccuracyByDifficulty: Record<string, number> = {
    easy: 0.6, medium: 0.55, hard: 0.5, expert: 0.45,
  };
  for (const row of crowdRows) {
    if (row.totalCount > 0) {
      crowdAccuracyByDifficulty[row.difficulty] = row.correctCount / row.totalCount;
    }
  }

  const sessions = inferSessions(allResults.map((r) => ({
    municipalityCode: r.municipalityCode,
    municipalityName: r.municipalityName,
    prefecture: r.prefecture,
    mode: r.mode,
    isCorrect: r.isCorrect,
    answeredAt: r.answeredAt,
  })));

  const cellAccuracies = computeCellAccuracies(sessions, masterMap as Map<string, { code: string; region: string; difficulty: string }>, crowdAccuracyByDifficulty);
  const fitZone = extractFitZone(cellAccuracies);

  const correctCodesByUser = new Set(
    allResults.filter((r) => r.isCorrect).map((r) => r.municipalityCode),
  );
  const cellCoverages = computeCellCoverages(allMasterRows, correctCodesByUser);

  // Weakness map: municipalityCode → errorRate
  const weaknessByMunicipality = new Map<string, number>();
  const codeStats = new Map<string, { total: number; wrong: number }>();
  for (const r of allResults) {
    const s = codeStats.get(r.municipalityCode) ?? { total: 0, wrong: 0 };
    s.total++;
    if (!r.isCorrect) s.wrong++;
    codeStats.set(r.municipalityCode, s);
  }
  for (const [code, { total, wrong }] of codeStats) {
    if (total > 0) weaknessByMunicipality.set(code, wrong / total);
  }

  // Last session accuracy
  const lastSession = sessions[sessions.length - 1] ?? null;
  const lastSessionAccuracy = lastSession?.accuracy ?? null;

  // Recent question counts (last 10 sessions)
  const recentSessions = sessions.slice(-10);
  const recentQuestionCounts = recentSessions.map((s) => s.count);

  // Codes played within the last 30 days — used by the coverage axis to avoid
  // re-surfacing recently seen municipalities when the unplayed pool is exhausted.
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const recentlyPlayedCodes = new Set<string>();
  for (const r of allResults) {
    if (now - r.answeredAt.getTime() <= THIRTY_DAYS_MS) {
      recentlyPlayedCodes.add(r.municipalityCode);
    }
  }

  const state: LearnerState = {
    userId,
    totalSessions: sessions.length,
    totalAnswers: allResults.length,
    cellAccuracies,
    cellCoverages,
    fitZone,
    weaknessByMunicipality,
    lastSessionAccuracy,
    recentQuestionCounts,
    recentlyPlayedCodes,
    crowdAccuracyByDifficulty: crowdAccuracyByDifficulty as Record<'easy' | 'medium' | 'hard' | 'expert', number>,
  };

  return { state, allMaster: allMasterRows };
}

export async function getRecommendation(
  input: GetRecommendationInput = {},
): Promise<Recommendation & { flags: { isColdStart: boolean; isRegressionGuarded: boolean; isProgressionFired: boolean; isDifficultyCapped: boolean }; notes: string[] }> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  if (!checkRateLimit(user.id)) throw new Error('Rate limit exceeded');

  const { state, allMaster } = await buildLearnerState(user.id);
  const recommendation = generateRecommendation(state, input.excludeCodes ?? [], allMaster);

  return {
    ...recommendation,
    flags: {
      isColdStart: state.totalAnswers < 10,
      isRegressionGuarded: recommendation.isRegressionGuarded,
      isProgressionFired: recommendation.isProgressionFired,
      isDifficultyCapped: state.fitZone.isCappedAt !== null,
    },
    notes: recommendation.poolBreakdown.randomFallback > 0
      ? [`${recommendation.poolBreakdown.randomFallback}問は推薦範囲外のランダム補充です`]
      : [],
  };
}
