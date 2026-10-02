'use server';

import { requireUserId } from '@/lib/auth/current-user';
import { db } from '@/lib/db';
import { srsRecords, municipalityMaster, municipalityQuizResults } from '@/lib/db/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { dueReviewCondition } from '@/lib/db/srs-due';
import {
  srsKeyId,
  validateSrsSnapshotKeys,
  type SrsSnapshotEntry,
  type SrsSnapshotKey,
  type SrsSnapshotRecord,
} from '@/lib/quiz/srs/snapshot';
import type { SrsStatus } from '@/lib/quiz/srs/types';

export type DueReviewItem = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  interval: number;
  dueDate: string;
  kana?: string;
};

export async function getDueReviewItems(opts?: { limit?: number }): Promise<DueReviewItem[]> {
  const limit = opts?.limit ?? 20;
  const userId = await requireUserId();

  const rows = await db
    .select({
      municipalityCode: srsRecords.municipalityCode,
      municipalityName: srsRecords.municipalityName,
      prefecture: srsRecords.prefecture,
      mode: srsRecords.mode,
      interval: srsRecords.interval,
      dueDate: srsRecords.dueDate,
      kana: municipalityMaster.kana,
    })
    .from(srsRecords)
    // left join: srsRecords 行は master に対応が無くても必ず残す（FR-005 グレースフルデグレード）。
    // code は municipality_master の PK なので、行が増える(1:多)心配はない。
    .leftJoin(municipalityMaster, eq(srsRecords.municipalityCode, municipalityMaster.code))
    // due 判定は JST の暦日単位（B013）。ダッシュボードの dueCount と揃えるため、
    // getDueReviewSummaryData（app/(app)/dashboard/queries.ts）と同じ境界を共通関数で使う。
    .where(dueReviewCondition(userId))
    // due 集合から均等ランダムに選定し、出題順もランダム化する（spec 007）。
    // 復習頻度の調整は SM-2 が dueDate で担うため、due 集合内の優先度付けは行わない。
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map((r) => ({
    municipalityCode: r.municipalityCode,
    municipalityName: r.municipalityName,
    prefecture: r.prefecture,
    mode: r.mode as 'A' | 'B' | 'C' | 'D',
    interval: r.interval,
    dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate),
    kana: r.kana ?? undefined,
  }));
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * 復習完了画面向けに、指定コード×モードの SRS 状態と誤答歴を本人分だけ read-only で返す。
 * 回答前（出題開始前）と回答後（保存成功分のみ）に呼ばれ、差分から成果ラベルを決める。
 */
function querySnapshotRecords(userId: string, codes: string[]) {
  return db
    .select({
      municipalityCode: srsRecords.municipalityCode,
      mode: srsRecords.mode,
      easeFactor: srsRecords.easeFactor,
      repetition: srsRecords.repetition,
      interval: srsRecords.interval,
      status: srsRecords.status,
      dueDate: srsRecords.dueDate,
      lastReviewedAt: srsRecords.lastReviewedAt,
    })
    .from(srsRecords)
    .where(and(eq(srsRecords.userId, userId), inArray(srsRecords.municipalityCode, codes)));
}

function queryWrongAnswerKeys(userId: string, codes: string[]) {
  return db
    .selectDistinct({
      municipalityCode: municipalityQuizResults.municipalityCode,
      mode: municipalityQuizResults.mode,
    })
    .from(municipalityQuizResults)
    .where(
      and(
        eq(municipalityQuizResults.userId, userId),
        eq(municipalityQuizResults.isCorrect, false),
        inArray(municipalityQuizResults.municipalityCode, codes),
      ),
    );
}

export async function getSrsSnapshot(input: SrsSnapshotKey[]): Promise<SrsSnapshotEntry[]> {
  try {
    const userId = await requireUserId();
    const keys = validateSrsSnapshotKeys(input);
    const codes = [...new Set(keys.map((k) => k.municipalityCode))];

    const [records, wrongRows] = await Promise.all([
      querySnapshotRecords(userId, codes),
      queryWrongAnswerKeys(userId, codes),
    ]);

    const recordById = new Map<string, SrsSnapshotRecord>(
      records.map((r) => [
        srsKeyId({ municipalityCode: r.municipalityCode, mode: r.mode as SrsSnapshotKey['mode'] }),
        {
          easeFactor: r.easeFactor,
          repetition: r.repetition,
          interval: r.interval,
          status: r.status as SrsStatus,
          dueDate: toIso(r.dueDate),
          lastReviewedAt: r.lastReviewedAt ? toIso(r.lastReviewedAt) : null,
        },
      ]),
    );
    const wrongIds = new Set(
      wrongRows.map((r) =>
        srsKeyId({ municipalityCode: r.municipalityCode, mode: r.mode as SrsSnapshotKey['mode'] }),
      ),
    );

    return keys.map((key) => {
      const id = srsKeyId(key);
      return { ...key, record: recordById.get(id) ?? null, everWrong: wrongIds.has(id) };
    });
  } catch (e) {
    console.error('[getSrsSnapshot] failed', {
      count: Array.isArray(input) ? input.length : undefined,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    throw e;
  }
}
