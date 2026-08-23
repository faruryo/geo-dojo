'use server';

import { requireUserId } from '@/lib/auth/current-user';
import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster, type MunicipalityMaster } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/quiz/rate-limit';
import { getValidCodes } from '@/lib/quiz/validation';
import { upsertSrsRecord } from '@/lib/quiz/srs/record-service';
import { buildLearnerState } from '@/lib/quiz/recommendation/state-builder';
import { generateRecommendation } from '@/lib/quiz/recommendation/engine';
import { normalizeAnswerTimeMs } from '@/lib/quiz/answer-time';
import type { Recommendation } from '@/lib/quiz/recommendation/types';

export async function saveMunicipalityQuizResult(input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  answerTimeMs?: number;
}): Promise<void> {
  // 本番では Next.js が server action の throw を digest に隠すため、原因を必ず明示ログしてから
  // 再 throw する。クライアントは Promise.allSettled で握り潰すので、ここが唯一の検知点になる。
  try {
    const userId = await requireUserId();

    if (!checkRateLimit(userId)) throw new Error('Rate limit exceeded');

    // Whitelist validate mode
    if (!['A', 'B', 'C', 'D'].includes(input.mode)) throw new Error('Invalid mode');

    // Validate municipality code against master data
    if (!(await getValidCodes()).has(input.municipalityCode)) throw new Error('Invalid municipality code');

    // Strict boolean check
    if (typeof input.isCorrect !== 'boolean') throw new Error('Invalid isCorrect');

    await db.insert(municipalityQuizResults).values({
      userId,
      municipalityCode: input.municipalityCode,
      municipalityName: input.municipalityName,
      prefecture: input.prefecture,
      mode: input.mode,
      isCorrect: input.isCorrect,
      answerTimeMs: normalizeAnswerTimeMs(input.answerTimeMs),
    });

    // SM-2 更新（全クイズ共通: 復習セッション・通常クイズ双方）
    // 逐次書き込みを維持（quiz 保存成功後に SRS 更新を実行し、失敗時は再 throw）
    await upsertSrsRecord(userId, input);
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

export async function getMunicipalityWeakness(): Promise<
  Array<{ municipalityCode: string; municipalityName: string; prefecture: string; errorRate: number }>
> {
  const userId = await requireUserId();

  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      errorRate: sql<number>`CAST(COUNT(*) FILTER (WHERE NOT ${municipalityQuizResults.isCorrect}) AS float) / COUNT(*)`,
    })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, userId))
    .groupBy(
      municipalityQuizResults.municipalityCode,
      municipalityQuizResults.municipalityName,
      municipalityQuizResults.prefecture,
    )
    .having(
      sql`COUNT(*) FILTER (WHERE NOT ${municipalityQuizResults.isCorrect}) > 0`,
    )
    .orderBy(
      sql`CAST(COUNT(*) FILTER (WHERE NOT ${municipalityQuizResults.isCorrect}) AS float) / COUNT(*) DESC`,
      sql`COUNT(*) DESC`,
    )
    .limit(100);

  return rows.map((r) => ({
    municipalityCode: r.municipalityCode,
    municipalityName: r.municipalityName,
    prefecture: r.prefecture,
    errorRate: Number(r.errorRate),
  }));
}

export async function getMunicipalityMaster(): Promise<MunicipalityMaster[]> {
  await requireUserId();
  return db.select().from(municipalityMaster);
}

type GetRecommendationInput = {
  excludeCodes?: string[];
  clientNowIso?: string;
};

export async function getRecommendation(
  input: GetRecommendationInput = {},
): Promise<Recommendation & { flags: { isColdStart: boolean; isRegressionGuarded: boolean; isProgressionFired: boolean; isDifficultyCapped: boolean }; notes: string[] }> {
  try {
    const userId = await requireUserId();
    if (!checkRateLimit(userId)) throw new Error('Rate limit exceeded');

    const { state, allMaster } = await buildLearnerState(userId);
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
  } catch (e) {
    console.error('[getRecommendation] failed', {
      excludeCodes: input.excludeCodes,
      error: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e),
    });
    throw e;
  }
}
