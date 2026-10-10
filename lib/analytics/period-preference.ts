export type AnalyticsPeriod = '7d' | '30d' | 'all';

const PREFIX = 'geodojo:analytics:period';

export function analyticsPeriodStorageKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function readAnalyticsPeriod(
  storage: Pick<Storage, 'getItem'>,
  userId: string,
): AnalyticsPeriod | null {
  try {
    const raw = storage.getItem(analyticsPeriodStorageKey(userId));
    if (raw === '7d' || raw === '30d' || raw === 'all') return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeAnalyticsPeriod(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  period: AnalyticsPeriod,
): void {
  storage.setItem(analyticsPeriodStorageKey(userId), period);
}
