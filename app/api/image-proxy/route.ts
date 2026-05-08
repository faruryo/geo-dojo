export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// インメモリレート制限（ユーザーあたり 1 分間 100 リクエスト）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 100;

  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return new NextResponse('Rate limit exceeded', { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const panoId = searchParams.get('pano_id');
  const width = searchParams.get('width') ?? '640';
  const height = searchParams.get('height') ?? '480';

  if (!panoId) {
    return new NextResponse('Missing pano_id', { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new NextResponse('Server configuration error', { status: 500 });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.searchParams.set('pano', panoId);
  url.searchParams.set('size', `${width}x${height}`);
  url.searchParams.set('key', apiKey);

  const upstream = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
