import type { RecommendClientState, LastModeSession } from './conquest-lottery';
import { cellSessionKey } from './conquest-lottery';
import type { GameMode } from './types';
import type { RecommendationHistoryCache } from './types';

const STORAGE_KEY = 'geodojo:recommendation:history';
const CLIENT_KEY = 'geodojo:recommendation:client-state';
const TTL_MS = 24 * 60 * 60 * 1000;

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

export function readRecommendClientState(): RecommendClientState {
  if (typeof window === 'undefined') return emptyClient();
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    if (!raw) return emptyClient();
    return parseClientState(raw);
  } catch {
    return emptyClient();
  }
}

/** Persist swap-once after a B/C recommend that used last A struggle. */
export function markSwapConsumedIfRecommended(mode: GameMode): void {
  if (mode !== 'B' && mode !== 'C') return;
  const client = readRecommendClientState();
  if (!client.lastA || client.lastA.accuracy >= 0.3) return;
  client.swapConsumedForASessionId = client.lastA.sessionId;
  writeRecommendClientState(client);
}

export function writeRecommendClientState(state: RecommendClientState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLIENT_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function startRecommendSession(sessionId: string, mode: GameMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      'geodojo:recommendation:active-session',
      JSON.stringify({ sessionId, mode, questions: [] } satisfies ActiveSession),
    );
  } catch {
    /* ignore */
  }
}

function readActiveSession(): ActiveSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('geodojo:recommendation:active-session');
    return raw ? (JSON.parse(raw) as ActiveSession) : null;
  } catch {
    return null;
  }
}

export function appendRecommendQuestion(question: ActiveQuestion): void {
  const active = readActiveSession();
  if (!active) return;
  active.questions.push(question);
  try {
    localStorage.setItem('geodojo:recommendation:active-session', JSON.stringify(active));
  } catch {
    /* ignore */
  }
}

export function finalizeRecommendSession(opts?: { swappedForA?: boolean }): void {
  const active = readActiveSession();
  if (!active || active.questions.length === 0) {
    try {
      localStorage.removeItem('geodojo:recommendation:active-session');
    } catch {
      /* ignore */
    }
    return;
  }

  const correct = active.questions.filter((q) => q.correct).length;
  const accuracy = correct / active.questions.length;
  const last: LastModeSession = {
    sessionId: active.sessionId,
    mode: active.mode,
    accuracy,
    questionCount: active.questions.length,
    region: active.questions[0]?.region ?? '',
    difficulty: active.questions[0]?.difficulty ?? 'easy',
  };

  const client = readRecommendClientState();
  if (active.mode === 'A') {
    client.lastA = last;
    if (opts?.swappedForA) {
      client.swapConsumedForASessionId = active.sessionId;
    }
  } else if (active.mode === 'B' || active.mode === 'C') {
    const byCell = new Map<string, ActiveQuestion[]>();
    for (const q of active.questions) {
      const key = cellSessionKey(active.mode, q.region, q.difficulty);
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
    client.lastByCell = nextCells;
  }

  writeRecommendClientState(client);
  try {
    localStorage.removeItem('geodojo:recommendation:active-session');
  } catch {
    /* ignore */
  }
}

export function readRecommendationHistory(): RecommendationHistoryCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export function writeRecommendationHistory(codes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cache: RecommendationHistoryCache = {
      lastCodes: codes,
      storedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
