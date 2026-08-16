import { db } from '@/lib/db';
import { srsRecords, municipalityQuizResults } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { computeSrsUpdate, type SrsUpdateAction } from './update';
import type { SrsStatus } from './types';

export interface UpsertSrsRecordInput {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: string;
  isCorrect: boolean;
  answerTimeMs?: number;
}

async function checkEverWrong(userId: string, municipalityCode: string, mode: string): Promise<boolean> {
  const [wrongRow] = await db
    .select({ one: sql<number>`1` })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        eq(municipalityQuizResults.municipalityCode, municipalityCode),
        eq(municipalityQuizResults.mode, mode),
        eq(municipalityQuizResults.isCorrect, false),
      ),
    )
    .limit(1);
  return Boolean(wrongRow);
}

async function persistSrsRecord(
  userId: string,
  input: UpsertSrsRecordInput,
  action: Exclude<SrsUpdateAction, { kind: 'skip' }>,
): Promise<void> {
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

/**
 * 解答結果に基づく SRS（SM-2 間隔反復）レコードの更新処理。
 *
 * 設計方針:
 * - db.transaction は用いず、quiz 保存後の逐次書き込みを維持する。
 * - 早期卒業判定のため、正解時のみ過去の誤答履歴（everWrong）を照会する。
 */
export async function upsertSrsRecord(
  userId: string,
  input: UpsertSrsRecordInput,
): Promise<void> {
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

  const everWrong = input.isCorrect
    ? await checkEverWrong(userId, input.municipalityCode, input.mode)
    : false;

  const action = computeSrsUpdate(
    existing
      ? {
          easeFactor: existing.easeFactor,
          repetition: existing.repetition,
          interval: existing.interval,
          status: existing.status as SrsStatus,
          dueDate: existing.dueDate,
          lastReviewedAt: existing.lastReviewedAt,
        }
      : null,
    input.isCorrect,
    new Date(),
    everWrong,
    input.answerTimeMs,
  );

  if (action.kind === 'skip') return;

  await persistSrsRecord(userId, input, action);
}
