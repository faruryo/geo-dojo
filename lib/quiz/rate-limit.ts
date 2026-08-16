/**
 * In-memory rate limiter: 60 req/min per user.
 * サーバーレス環境での過剰リクエスト防止用ガード。
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string): boolean {
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
