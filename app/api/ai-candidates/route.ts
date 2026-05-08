export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiCandidates } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { and, eq, inArray } from 'drizzle-orm';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db
    .select()
    .from(aiCandidates)
    .where(
      and(
        eq(aiCandidates.userId, user.id),
        inArray(aiCandidates.status, ['pending', 'processing']),
      ),
    )
    .orderBy(aiCandidates.createdAt);

  return NextResponse.json(result);
}
