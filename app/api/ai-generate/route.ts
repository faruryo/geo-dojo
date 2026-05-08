export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiCandidates } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';
import { generateCardFromImage } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { imageUrl, panoId } = await req.json() as {
    imageUrl?: string;
    panoId?: string;
  };

  if (!imageUrl && !panoId) {
    return NextResponse.json(
      { error: 'imageUrl or panoId is required' },
      { status: 400 },
    );
  }

  // 候補レコードを先に作成（processing 状態）
  const [candidate] = await db
    .insert(aiCandidates)
    .values({
      userId: user.id,
      imageUrl,
      panoId,
      status: 'processing',
    })
    .returning();

  // 非同期で Gemini 処理（waitUntil 相当 — レスポンスを先に返す）
  const targetUrl = imageUrl ?? `/api/image-proxy?pano_id=${panoId}&width=640&height=480`;

  const candidateId = candidate.id;
  generateCardFromImage(targetUrl)
    .then(async ({ notes, suggestedTags }) => {
      const { eq } = await import('drizzle-orm');
      await db
        .update(aiCandidates)
        .set({ suggestedNotes: notes, suggestedTags, status: 'pending' })
        .where(eq(aiCandidates.id, candidateId));
    })
    .catch(async (err) => {
      console.error('[ai-generate] Gemini processing failed:', err);
      const { eq } = await import('drizzle-orm');
      await db
        .update(aiCandidates)
        .set({ status: 'failed' })
        .where(eq(aiCandidates.id, candidateId));
    });

  return NextResponse.json(
    { candidateId: candidate.id, status: 'processing' },
    { status: 202 },
  );
}
