export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiCandidates, cards, srsRecords } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { action, notes, tags } = await req.json() as {
    action: 'approve' | 'reject';
    notes?: string;
    tags?: string[];
  };

  const [candidate] = await db
    .select()
    .from(aiCandidates)
    .where(and(eq(aiCandidates.id, id), eq(aiCandidates.userId, user.id)))
    .limit(1);

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (candidate.status === 'approved' || candidate.status === 'rejected') {
    return NextResponse.json({ error: 'Already processed' }, { status: 409 });
  }

  if (action === 'reject') {
    await db
      .update(aiCandidates)
      .set({ status: 'rejected' })
      .where(eq(aiCandidates.id, id));
    return NextResponse.json({ status: 'rejected' });
  }

  // approve: カード作成 + srs_records 初期化
  const finalNotes = notes ?? candidate.suggestedNotes ?? undefined;
  const finalTags = tags ?? candidate.suggestedTags;

  const [card] = await db
    .insert(cards)
    .values({
      userId: user.id,
      notes: finalNotes,
      tags: finalTags,
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

  await db
    .update(aiCandidates)
    .set({ status: 'approved' })
    .where(eq(aiCandidates.id, id));

  return NextResponse.json({ status: 'approved', cardId: card.id });
}
