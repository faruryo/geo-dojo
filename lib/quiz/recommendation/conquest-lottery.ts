import type { Difficulty, GameMode } from '@/lib/quiz/municipality-data';
import type { LearnerState, Recommendation, RegionValue } from './types';
import { DIFFICULTY_ORDER, REGION_VALUES } from './types';
import { coverageRate } from './coverage-cells';

export type LastModeSession = {
  sessionId: string;
  mode: GameMode;
  accuracy: number;
  questionCount: number;
  region: string;
  difficulty: string;
};

export type RecommendClientState = {
  lastA: LastModeSession | null;
  lastByCell: Partial<Record<string, LastModeSession>>;
  swapConsumedForASessionId: string | null;
};

type MasterEntry = {
  code: string;
  region: string;
  difficulty: string;
  name: string;
  prefecture: string;
};

const STRUGGLE_ACCURACY = 0.3;
const COVERAGE_THRESHOLD = 0.9;

type QuestionCount = 10 | 20 | 30;

export function cellSessionKey(mode: 'B' | 'C', region: string, difficulty: string): string {
  return `${mode}:${region}:${difficulty}`;
}

/** Most frequent recent session length (ties keep the earlier count). */
export function modeFrequency(counts: readonly QuestionCount[]): QuestionCount {
  if (counts.length === 0) return 10;
  const order: QuestionCount[] = [];
  const freq = new Map<QuestionCount, number>();
  for (const c of counts) {
    if (!freq.has(c)) order.push(c);
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  let best: QuestionCount = 10;
  let bestCount = -1;
  for (const k of order) {
    const v = freq.get(k) ?? 0;
    if (v > bestCount) {
      bestCount = v;
      best = k;
    }
  }
  return best;
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  if (items.length === 0) {
    throw new Error('pickOne: empty list');
  }
  const i = Math.min(items.length - 1, Math.floor(random() * items.length));
  const item = items.at(i);
  if (item === undefined) {
    throw new Error('pickOne: empty list');
  }
  return item;
}

function playableRegions(mode: GameMode): RegionValue[] {
  if (mode === 'A') {
    return REGION_VALUES.filter((r) => r !== '北海道');
  }
  return [...REGION_VALUES];
}

function isPlayableCell(mode: GameMode, region: string): boolean {
  return mode !== 'A' || region !== '北海道';
}

function regionHasHole(
  mode: GameMode,
  region: string,
  master: readonly MasterEntry[],
  cleared: ReadonlySet<string>,
): boolean {
  return DIFFICULTY_ORDER.some((d) => coverageRate(mode, region, d, master, cleared).rate < COVERAGE_THRESHOLD);
}

function easiestOpenDifficulty(
  mode: GameMode,
  region: string,
  master: readonly MasterEntry[],
  cleared: ReadonlySet<string>,
): Difficulty {
  for (const d of DIFFICULTY_ORDER) {
    if (coverageRate(mode, region, d, master, cleared).rate < COVERAGE_THRESHOLD) {
      return d;
    }
  }
  return 'easy';
}

type PickedCell = { mode: GameMode; region: RegionValue; difficulty: Difficulty };

function pickMinCoverageCell(
  master: readonly MasterEntry[],
  clearedByMode: ReadonlyMap<GameMode, ReadonlySet<string>>,
  random: () => number,
): PickedCell {
  const candidates: Array<PickedCell & { rate: number }> = [];
  for (const mode of ['A', 'D'] as GameMode[]) {
    const cleared = clearedByMode.get(mode) ?? new Set();
    for (const region of playableRegions(mode)) {
      if (!isPlayableCell(mode, region)) continue;
      for (const difficulty of DIFFICULTY_ORDER) {
        const { rate, total } = coverageRate(mode, region, difficulty, master, cleared);
        if (total === 0) continue;
        candidates.push({ mode, region, difficulty, rate });
      }
    }
  }
  if (candidates.length === 0) {
    return { mode: 'D', region: '北海道', difficulty: 'easy' };
  }
  const min = Math.min(...candidates.map((c) => c.rate));
  const lowest = candidates.filter((c) => c.rate === min);
  const chosen = pickOne(lowest, random);
  return { mode: chosen.mode, region: chosen.region, difficulty: chosen.difficulty };
}

function lastForCell(
  client: RecommendClientState | undefined,
  key: string,
): LastModeSession | undefined {
  if (!client) return undefined;
  for (const [storedKey, session] of Object.entries(client.lastByCell)) {
    if (storedKey === key) return session;
  }
  return undefined;
}

function applyStruggleSwap(
  cell: PickedCell,
  client: RecommendClientState | undefined,
  random: () => number,
): GameMode {
  if (cell.mode !== 'A') return cell.mode;
  const lastA = client?.lastA ?? null;
  if (!lastA || lastA.accuracy >= STRUGGLE_ACCURACY) return 'A';
  if (client?.swapConsumedForASessionId === lastA.sessionId) return 'A';

  const b = lastForCell(client, cellSessionKey('B', cell.region, cell.difficulty));
  const c = lastForCell(client, cellSessionKey('C', cell.region, cell.difficulty));
  const bLow = !b || b.accuracy < STRUGGLE_ACCURACY;
  const cLow = !c || c.accuracy < STRUGGLE_ACCURACY;
  if (b && c && !bLow && !cLow) return 'A';

  const pool: Array<'B' | 'C'> = [];
  if (bLow) pool.push('B');
  if (cLow) pool.push('C');
  if (pool.length === 0) return 'A';
  return pickOne(pool, random);
}

function codesForCell(
  cell: PickedCell,
  master: readonly MasterEntry[],
  excludeCodes: string[],
  count: number,
): string[] {
  const exclude = new Set(excludeCodes);
  const list = master
    .filter((m) => m.region === cell.region && m.difficulty === cell.difficulty)
    .map((m) => m.code)
    .filter((c) => !exclude.has(c));
  return list.slice(0, count);
}

export function generateConquestRecommendation(
  state: LearnerState,
  excludeCodes: string[],
  allMaster: MasterEntry[],
  options?: {
    random?: () => number;
    client?: RecommendClientState;
  },
): Recommendation {
  const random = options?.random ?? Math.random;
  const client = options?.client;
  const count = modeFrequency(state.recentQuestionCounts);

  const emptyCleared = new Set<string>();
  const clearedA = state.clearedCodesByMode?.get('A') ?? emptyCleared;
  const clearedD = state.clearedCodesByMode?.get('D') ?? emptyCleared;
  const clearedByMode = new Map<GameMode, ReadonlySet<string>>([
    ['A', clearedA],
    ['D', clearedD],
  ]);

  const coinMode: GameMode = random() < 0.5 ? 'A' : 'D';
  const regions = playableRegions(coinMode);
  const cleared = coinMode === 'A' ? clearedA : clearedD;
  const openRegions = regions.filter((r) => regionHasHole(coinMode, r, allMaster, cleared));

  let cell: PickedCell;
  if (openRegions.length === 0) {
    cell = pickMinCoverageCell(allMaster, clearedByMode, random);
  } else {
    const region = pickOne(openRegions, random);
    cell = {
      mode: coinMode,
      region,
      difficulty: easiestOpenDifficulty(coinMode, region, allMaster, cleared),
    };
  }

  const mode = applyStruggleSwap(cell, client, random);
  const codes = codesForCell(cell, allMaster, excludeCodes, count);

  return {
    mode,
    difficulties: [cell.difficulty],
    regions: [cell.region],
    count,
    codes,
    rationaleCategory: 'new-exploration',
    rationaleText: `${cell.region}の${cell.difficulty}（モード${mode}）`,
    poolBreakdown: {
      fitZoneWeakness: 0,
      coverageNew: codes.length,
      exploration: 0,
      randomFallback: 0,
    },
    isProgressionFired: false,
    isRegressionGuarded: Boolean(client?.lastA && client.lastA.accuracy < STRUGGLE_ACCURACY),
  };
}
