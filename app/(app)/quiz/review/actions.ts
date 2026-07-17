'use server';

import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { srsRecords, municipalityMaster } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { dueReviewCondition } from '@/lib/db/srs-due';

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

  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

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
    .where(dueReviewCondition(user.id))
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
