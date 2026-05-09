'use server';

import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';

export async function deleteCard(cardId: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  await db.delete(cards).where(and(eq(cards.id, cardId), eq(cards.userId, user.id)));
}
