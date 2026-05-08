'use server';

import { db } from '@/lib/db';
import { srsRecords } from '@/lib/db/schema';
import { calculateNextReview, type Rating } from '@/lib/srs/algorithm';
import { createServerClient } from '@/lib/supabase/client';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function submitRating(cardId: string, rating: Rating) {
  const supabase = createServerClient();
  const headersList = await headers();
  const authorization = headersList.get('Authorization') ?? '';

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authorization.replace('Bearer ', ''),
  );
  if (authError || !user) throw new Error('Unauthorized');

  const [existing] = await db
    .select()
    .from(srsRecords)
    .where(
      and(eq(srsRecords.userId, user.id), eq(srsRecords.cardId, cardId)),
    )
    .limit(1);

  const record = existing ?? { interval: 1, easiness: 2.5, reps: 0 };
  const update = calculateNextReview(record, rating);

  if (existing) {
    await db
      .update(srsRecords)
      .set({
        dueDate: update.dueDate,
        interval: update.interval,
        easiness: update.easiness,
        reps: update.reps,
        lastRatedAt: new Date(),
      })
      .where(eq(srsRecords.id, existing.id));
  } else {
    await db.insert(srsRecords).values({
      userId: user.id,
      cardId,
      dueDate: update.dueDate,
      interval: update.interval,
      easiness: update.easiness,
      reps: update.reps,
      lastRatedAt: new Date(),
    });
  }

  return { nextDueDate: update.dueDate, interval: update.interval };
}
