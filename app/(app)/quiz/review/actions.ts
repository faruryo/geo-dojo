'use server';

import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { srsRecords } from '@/lib/db/schema';
import { eq, and, lte, asc } from 'drizzle-orm';

export type DueReviewItem = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  interval: number;
  dueDate: string;
};

export async function getDueReviewItems(opts?: { limit?: number }): Promise<DueReviewItem[]> {
  const limit = opts?.limit ?? 20;

  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const now = new Date();

  const rows = await db
    .select({
      municipalityCode: srsRecords.municipalityCode,
      municipalityName: srsRecords.municipalityName,
      prefecture: srsRecords.prefecture,
      mode: srsRecords.mode,
      interval: srsRecords.interval,
      dueDate: srsRecords.dueDate,
    })
    .from(srsRecords)
    .where(
      and(
        eq(srsRecords.userId, user.id),
        eq(srsRecords.status, 'reviewing'),
        lte(srsRecords.dueDate, now),
      ),
    )
    .orderBy(asc(srsRecords.dueDate), asc(srsRecords.interval))
    .limit(limit);

  return rows.map((r) => ({
    municipalityCode: r.municipalityCode,
    municipalityName: r.municipalityName,
    prefecture: r.prefecture,
    mode: r.mode as 'A' | 'B' | 'C' | 'D',
    interval: r.interval,
    dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : String(r.dueDate),
  }));
}
