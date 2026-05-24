'use server';

import * as fs from 'fs';
import * as path from 'path';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster, type MunicipalityMaster } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// Lazy-loaded municipality validation set (loaded once, reused across requests)
let _validCodes: Set<string> | null = null;

function getValidCodes(): Set<string> {
  if (_validCodes) return _validCodes;
  const filePath = path.join(process.cwd(), 'public', 'municipalities.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { code: string }[];
  _validCodes = new Set(data.map((m) => m.code));
  return _validCodes;
}

// In-memory rate limiter: 60 req/min per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) {
    console.warn('[rate-limit] municipality quiz rate exceeded', { userId });
    return false;
  }
  entry.count++;
  return true;
}

export async function saveMunicipalityQuizResult(input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
}): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  if (!checkRateLimit(user.id)) throw new Error('Rate limit exceeded');

  // Whitelist validate mode
  if (!['A', 'B', 'C', 'D'].includes(input.mode)) throw new Error('Invalid mode');

  // Validate municipality code against master data
  if (!getValidCodes().has(input.municipalityCode)) throw new Error('Invalid municipality code');

  // Strict boolean check
  if (typeof input.isCorrect !== 'boolean') throw new Error('Invalid isCorrect');

  await db.insert(municipalityQuizResults).values({
    userId: user.id,
    municipalityCode: input.municipalityCode,
    municipalityName: input.municipalityName,
    prefecture: input.prefecture,
    mode: input.mode,
    isCorrect: input.isCorrect,
  });
}

export async function getMunicipalityWeakness(): Promise<
  Array<{ municipalityCode: string; municipalityName: string; prefecture: string; errorRate: number }>
> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const rows = await db
    .select({
      municipalityCode: municipalityQuizResults.municipalityCode,
      municipalityName: municipalityQuizResults.municipalityName,
      prefecture: municipalityQuizResults.prefecture,
      total: sql<number>`CAST(COUNT(*) AS int)`,
      wrong: sql<number>`CAST(COUNT(*) FILTER (WHERE NOT ${municipalityQuizResults.isCorrect}) AS int)`,
    })
    .from(municipalityQuizResults)
    .where(eq(municipalityQuizResults.userId, user.id))
    .groupBy(
      municipalityQuizResults.municipalityCode,
      municipalityQuizResults.municipalityName,
      municipalityQuizResults.prefecture,
    )
    .limit(200);

  return rows
    .map((r) => ({
      municipalityCode: r.municipalityCode,
      municipalityName: r.municipalityName,
      prefecture: r.prefecture,
      errorRate: r.total > 0 ? r.wrong / r.total : 0,
    }))
    .filter((r) => r.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 100);
}

export async function getMunicipalityMaster(): Promise<MunicipalityMaster[]> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  return db.select().from(municipalityMaster);
}
