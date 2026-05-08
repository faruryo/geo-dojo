export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards, annotations, srsRecords } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { and, eq, lte, inArray } from 'drizzle-orm';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  const now = new Date();

  const dueRecords = await db
    .select()
    .from(srsRecords)
    .innerJoin(cards, eq(cards.id, srsRecords.cardId))
    .where(
      and(
        eq(srsRecords.userId, userId),
        lte(srsRecords.dueDate, now),
      ),
    )
    .orderBy(srsRecords.dueDate)
    .limit(20);

  const cardIds = dueRecords.map((r) => r.cards.id);

  const cardAnnotations = cardIds.length
    ? await db
        .select()
        .from(annotations)
        .where(inArray(annotations.cardId, cardIds))
    : [];

  const annotationsByCard = cardAnnotations.reduce<Record<string, typeof cardAnnotations>>(
    (acc, ann) => {
      acc[ann.cardId] = [...(acc[ann.cardId] ?? []), ann];
      return acc;
    },
    {},
  );

  const result = dueRecords.map(({ cards: card, srs_records: srs }) => ({
    ...card,
    annotations: annotationsByCard[card.id] ?? [],
    srsRecord: srs,
  }));

  return NextResponse.json({ cards: result, totalDue: result.length });
}
