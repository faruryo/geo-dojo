'use server';

import { db } from '@/lib/db';
import { aiCandidates, cards, srsRecords } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';

export async function approveCandidate(id: string, notes: string, tags: string[]) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const [candidate] = await db
    .select()
    .from(aiCandidates)
    .where(and(eq(aiCandidates.id, id), eq(aiCandidates.userId, user.id)))
    .limit(1);

  if (!candidate) throw new Error('Not found');
  if (candidate.status === 'approved' || candidate.status === 'rejected') throw new Error('Already processed');

  const [card] = await db
    .insert(cards)
    .values({
      userId: user.id,
      notes: notes || undefined,
      tags,
      imageUrl: candidate.imageUrl ?? undefined,
      panoId: candidate.panoId ?? undefined,
    })
    .returning();

  await db.insert(srsRecords).values({
    userId: user.id,
    cardId: card.id,
    dueDate: new Date(),
    interval: 1,
    easiness: 2.5,
    reps: 0,
  });

  await db.update(aiCandidates).set({ status: 'approved' }).where(eq(aiCandidates.id, id));
  return { cardId: card.id };
}

export async function rejectCandidate(id: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  await db
    .update(aiCandidates)
    .set({ status: 'rejected' })
    .where(and(eq(aiCandidates.id, id), eq(aiCandidates.userId, user.id)));
}
