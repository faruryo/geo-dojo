'use server';

import { requireUserId } from '@/lib/auth/current-user';
import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster, type MunicipalityMaster } from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/quiz/rate-limit';
import { getValidCodes } from '@/lib/quiz/validation';
import { upsertSrsRecord } from '@/lib/quiz/srs/record-service';
import { buildLearnerState } from '@/lib/quiz/recommendation/state-builder';
import { generateRecommendation } from '@/lib/quiz/recommendation/engine';
import type { RecommendClientState } from '@/lib/quiz/recommendation/conquest-lottery';
import { normalizeAnswerTimeMs } from '@/lib/quiz/answer-time';
import type { Recommendation } from '@/lib/quiz/recommendation/types';
import { notSameNameSql, notTokyoSpecialWardSql } from '@/lib/db/queries/sql-helpers';

export type MunicipalityQuizMode = 'A' | 'B' | 'C' | 'D';

export interface SaveMunicipalityQuizResultInput {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: MunicipalityQuizMode;
  isCorrect: boolean;
  answerTimeMs?: number;
}

function validateBasicBatch(results: SaveMunicipalityQuizResultInput[]): MunicipalityQuizMode {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Results array must not be empty');
  }
  const firstMode = results[0].mode;
  if (!['A', 'B', 'C', 'D'].includes(firstMode)) {
    throw new Error('Invalid mode');
  }
  for (const r of results) {
    if (r.mode !== firstMode) {
      throw new Error('Inconsistent modes in batch');
    }
    if (typeof r.isCorrect !== 'boolean') {
      throw new Error('Invalid isCorrect');
    }
  }
  return firstMode;
}

async function validateModeABatch(results: SaveMunicipalityQuizResultInput[]): Promise<void> {
  if (results.length < 1 || results.length > 10) {
    throw new Error('Mode A batch size must be between 1 and 10');
  }
  const codes = results.map((r) => r.municipalityCode);
  if (new Set(codes).size !== codes.length) {
    throw new Error('Duplicate municipalityCode in batch');
  }

  const masterRows = await db
    .select({ code: municipalityMaster.code, name: municipalityMaster.name })
    .from(municipalityMaster)
    .where(inArray(municipalityMaster.code, codes));

  if (masterRows.length !== codes.length) {
    throw new Error('One or more municipality codes not found in master');
  }

  const canonicalName = masterRows[0].name;
  for (const row of masterRows) {
    if (row.name !== canonicalName) {
      throw new Error('Master municipality names do not match across batch');
    }
  }
  for (const r of results) {
    if (r.municipalityName !== canonicalName) {
      throw new Error('Input municipalityName does not match master canonical name');
    }
  }

  const expectedMasterRows = await db
    .select({ code: municipalityMaster.code })
    .from(municipalityMaster)
    .where(
      and(
        eq(municipalityMaster.name, canonicalName),
        notSameNameSql,
        notTokyoSpecialWardSql,
      ),
    );

  const expectedCodes = new Set(expectedMasterRows.map((r) => r.code));
  if (codes.length !== expectedCodes.size || !codes.every((c) => expectedCodes.has(c))) {
    throw new Error('Mode A batch must contain all eligible municipality codes for the given name');
  }
}

async function validateNonAModeBatch(results: SaveMunicipalityQuizResultInput[]): Promise<void> {
  if (results.length !== 1) {
    throw new Error('Mode B, C, and D must have exactly 1 result');
  }
  const item = results[0];
  const [masterRow] = await db
    .select({ code: municipalityMaster.code })
    .from(municipalityMaster)
    .where(eq(municipalityMaster.code, item.municipalityCode))
    .limit(1);

  if (!masterRow) {
    throw new Error('Invalid municipality code');
  }
}

export async function saveMunicipalityQuizResults(
  results: SaveMunicipalityQuizResultInput[],
): Promise<{ quizPersisted: boolean; srsPersisted: boolean }> {
  try {
    const userId = await requireUserId();
    if (!checkRateLimit(userId)) throw new Error('Rate limit exceeded');

    const mode = validateBasicBatch(results);
    if (mode === 'A') {
      await validateModeABatch(results);
    } else {
      await validateNonAModeBatch(results);
    }

    const serverAnsweredAt = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(municipalityQuizResults).values(
        results.map((r) => ({
          userId,
          municipalityCode: r.municipalityCode,
          municipalityName: r.municipalityName,
          prefecture: r.prefecture,
          mode: r.mode,
          isCorrect: r.isCorrect,
          answeredAt: serverAnsweredAt,
          answerTimeMs: normalizeAnswerTimeMs(r.answerTimeMs),
        })),
      );

      for (const r of results) {
        await upsertSrsRecord(userId, r, tx);
      }
    });

    return { quizPersisted: true, srsPersisted: true };
  } catch (e) {
    console.error('[saveMunicipalityQuizResults] failed', {
      count: results?.length,
      mode: results?.[0]?.mode,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    throw e;
  }
}

export async function saveMunicipalityQuizResult(input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  answerTimeMs?: number;
}): Promise<{ quizPersisted: boolean; srsPersisted: boolean }> {
  // 本番では Next.js が server action の throw を digest に隠すため、原因を必ず明示ログしてから
  // 再 throw する。クライアントは Promise.allSettled で握り潰すので、ここが唯一の検知点になる。
  try {
    const userId = await requireUserId();

    if (!checkRateLimit(userId)) throw new Error('Rate limit exceeded');

    // Whitelist validate mode
    if (!['A', 'B', 'C', 'D'].includes(input.mode)) throw new Error('Invalid mode');
    if (input.mode === 'A') {
      throw new Error('Mode A results must be saved via saveMunicipalityQuizResults batch action');
    }

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

    try {
      await upsertSrsRecord(userId, input);
    } catch (srsErr) {
      console.error('[saveMunicipalityQuizResult] srs failed after quiz insert', {
        code: input.municipalityCode,
        mode: input.mode,
        error: srsErr instanceof Error ? `${srsErr.name}: ${srsErr.message}` : String(srsErr),
      });
      return { quizPersisted: true, srsPersisted: false };
    }
    return { quizPersisted: true, srsPersisted: true };
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

export async function getClearedMunicipalityCodes(mode: string): Promise<string[]> {
  const userId = await requireUserId();

  const rows = await db
    .selectDistinct({
      municipalityCode: municipalityQuizResults.municipalityCode,
    })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        eq(municipalityQuizResults.mode, mode),
        eq(municipalityQuizResults.isCorrect, true),
      ),
    );

  return rows.map((r) => r.municipalityCode);
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
    );

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
  client?: RecommendClientState;
};

export async function getRecommendation(
  input: GetRecommendationInput = {},
): Promise<Recommendation & { flags: { isColdStart: boolean; isRegressionGuarded: boolean; isProgressionFired: boolean; isDifficultyCapped: boolean }; notes: string[] }> {
  try {
    const userId = await requireUserId();
    if (!checkRateLimit(userId)) throw new Error('Rate limit exceeded');

    const { state, allMaster } = await buildLearnerState(userId);
    const recommendation = generateRecommendation(state, input.excludeCodes ?? [], allMaster, {
      client: input.client,
    });

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
