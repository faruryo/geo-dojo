export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { and, eq, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tagsParam = req.nextUrl.searchParams.get('tags');
  const filterTags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];

  const conditions = [eq(cards.userId, user.id)];
  if (filterTags.length) {
    conditions.push(sql`${cards.tags} @> ARRAY[${sql.join(filterTags.map((t) => sql`${t}`), sql`, `)}]::text[]`);
  }

  const result = await db
    .select()
    .from(cards)
    .where(and(...conditions))
    .orderBy(cards.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { notes, tags, imageUrl, panoId, annotations: annList } = body;

  if (!notes && (!annList || annList.length === 0)) {
    return NextResponse.json(
      { error: 'Card must have notes or annotations' },
      { status: 400 },
    );
  }

  const [card] = await db
    .insert(cards)
    .values({ userId: user.id, notes, tags: tags ?? [], imageUrl, panoId })
    .returning();

  if (annList?.length) {
    const { annotations } = await import('@/lib/db/schema');
    await db.insert(annotations).values(
      annList.map((a: { xRatio: number; yRatio: number; label: string }) => ({
        cardId: card.id,
        xRatio: a.xRatio,
        yRatio: a.yRatio,
        label: a.label,
      })),
    );
  }

  // srs_records 初期化
  const { srsRecords } = await import('@/lib/db/schema');
  await db.insert(srsRecords).values({
    userId: user.id,
    cardId: card.id,
    dueDate: new Date(),
    interval: 1,
    easiness: 2.5,
    reps: 0,
  });

  return NextResponse.json({ cardId: card.id }, { status: 201 });
}
