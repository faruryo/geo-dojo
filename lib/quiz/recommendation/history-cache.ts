import type { RecommendClientState, LastModeSession } from './conquest-lottery';
import { cellSessionKey } from './conquest-lottery';
import type { GameMode } from './types';
import type { RecommendationHistoryCache } from './types';

const STORAGE_KEY = 'geodojo:recommendation:history';
const CLIENT_KEY = 'geodojo:recommendation:client-state';
const ACTIVE_KEY = 'geodojo:recommendation:active-session';
const ACTIVE_OWNER_KEY = 'geodojo:recommendation:active-owner';
const TTL_MS = 24 * 60 * 60 * 1000;

export function scopedRecommendKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

type ActiveQuestion = {
  correct: boolean;
  region: string;
  difficulty: string;
  mode: GameMode;
};

type ActiveSession = {
  sessionId: string;
  mode: GameMode;
  questions: ActiveQuestion[];
};

function emptyClient(): RecommendClientState {
  return { lastA: null, lastByCell: {}, swapConsumedForASessionId: null };
}

function parseClientState(raw: string): RecommendClientState {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return emptyClient();
  return { ...emptyClient(), ...parsed };
}

export function readRecommendClientState(userId: string | null): RecommendClientState {
  if (typeof window === 'undefined' || !userId) return emptyClient();
  try {
    const raw = localStorage.getItem(scopedRecommendKey(CLIENT_KEY, userId));
    if (!raw) return emptyClient();
    return parseClientState(raw);
  } catch {
    return emptyClient();
  }
}

/** Persist swap-once after a B/C recommend that used last A struggle. */
export function markSwapConsumedIfRecommended(userId: string | null, mode: GameMode): void {
  if (mode !== 'B' && mode !== 'C') return;
  const client = readRecommendClientState(userId);
  if (!client.lastA || client.lastA.accuracy >= 0.3) return;
  client.swapConsumedForASessionId = client.lastA.sessionId;
  writeRecommendClientState(userId, client);
}

export function writeRecommendClientState(
  userId: string | null,
  state: RecommendClientState,
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(scopedRecommendKey(CLIENT_KEY, userId), JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function startRecommendSession(
  userId: string | null,
  sessionId: string,
  mode: GameMode,
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(
      scopedRecommendKey(ACTIVE_KEY, userId),
      JSON.stringify({ sessionId, mode, questions: [] } satisfies ActiveSession),
    );
    localStorage.setItem(ACTIVE_OWNER_KEY, userId);
  } catch {
    /* ignore */
  }
}

function readActiveSession(userId: string | null): ActiveSession | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(scopedRecommendKey(ACTIVE_KEY, userId));
    return raw ? (JSON.parse(raw) as ActiveSession) : null;
  } catch {
    return null;
  }
}

export function readActiveRecommendUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_OWNER_KEY);
  } catch {
    return null;
  }
}

export function appendRecommendQuestion(userId: string | null, question: ActiveQuestion): void {
  const active = readActiveSession(userId);
  if (!active || !userId) return;
  active.questions.push(question);
  try {
    localStorage.setItem(scopedRecommendKey(ACTIVE_KEY, userId), JSON.stringify(active));
  } catch {
    /* ignore */
  }
}

function clearActiveSession(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(scopedRecommendKey(ACTIVE_KEY, userId));
    localStorage.removeItem(ACTIVE_OWNER_KEY);
  } catch {
    /* ignore */
  }
}

function mergeBcCellSessions(
  client: RecommendClientState,
  active: ActiveSession,
): RecommendClientState {
  const byCell = new Map<string, ActiveQuestion[]>();
  for (const q of active.questions) {
    const key = cellSessionKey(active.mode as 'B' | 'C', q.region, q.difficulty);
    const list = byCell.get(key) ?? [];
    list.push(q);
    byCell.set(key, list);
  }
  const nextCells = { ...client.lastByCell };
  for (const [key, qs] of byCell) {
    const first = qs[0];
    if (!first) continue;
    const acc = qs.filter((q) => q.correct).length / qs.length;
    Object.assign(nextCells, {
      [key]: {
        sessionId: active.sessionId,
        mode: active.mode,
        accuracy: acc,
        questionCount: qs.length,
        region: first.region,
        difficulty: first.difficulty,
      } satisfies LastModeSession,
    });
  }
  return { ...client, lastByCell: nextCells };
}

export function finalizeRecommendSession(
  userId: string | null,
  opts?: { swappedForA?: boolean },
): void {
  const active = readActiveSession(userId);
  if (!userId) return;
  if (!active || active.questions.length === 0) {
    clearActiveSession(userId);
    return;
  }

  const correct = active.questions.filter((q) => q.correct).length;
  const last: LastModeSession = {
    sessionId: active.sessionId,
    mode: active.mode,
    accuracy: correct / active.questions.length,
    questionCount: active.questions.length,
    region: active.questions[0]?.region ?? '',
    difficulty: active.questions[0]?.difficulty ?? 'easy',
  };

  let client = readRecommendClientState(userId);
  if (active.mode === 'A') {
    client.lastA = last;
    if (opts?.swappedForA) {
      client.swapConsumedForASessionId = active.sessionId;
    }
  } else if (active.mode === 'B' || active.mode === 'C') {
    client = mergeBcCellSessions(client, active);
  }

  writeRecommendClientState(userId, client);
  clearActiveSession(userId);
}

export function readRecommendationHistory(
  userId: string | null,
): RecommendationHistoryCache | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(scopedRecommendKey(STORAGE_KEY, userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const cache = parsed as RecommendationHistoryCache;
    const storedAt = new Date(cache.storedAt).getTime();
    if (Date.now() - storedAt > TTL_MS) return null;
    return cache;
  } catch {
    return null;
  }
}

export function writeRecommendationHistory(userId: string | null, codes: string[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const cache: RecommendationHistoryCache = {
      lastCodes: codes,
      storedAt: new Date().toISOString(),
    };
    localStorage.setItem(scopedRecommendKey(STORAGE_KEY, userId), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
