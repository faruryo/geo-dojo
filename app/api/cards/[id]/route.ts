export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  await db
    .delete(cards)
    .where(and(eq(cards.id, id), eq(cards.userId, user.id)));

  return new NextResponse(null, { status: 204 });
}
