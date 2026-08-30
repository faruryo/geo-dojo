import { isSameNameMunicipality } from '@/lib/quiz/municipality-data';
import type { Difficulty, GameMode, Region } from './types';
import { DIFFICULTY_ORDER, REGION_VALUES } from './types';

export type CoverageCell = {
  mode: GameMode;
  region: Region;
  difficulty: Difficulty;
  total: number;
  cleared: number;
  rate: number;
};

type MasterEntry = {
  code: string;
  name: string;
  prefecture: string;
  region: string;
  difficulty: string;
};

function aNameUnits(
  master: readonly MasterEntry[],
  region: string,
  difficulty: string,
): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const m of master) {
    if (m.region !== region || m.difficulty !== difficulty) continue;
    if (isSameNameMunicipality(m.name, m.prefecture)) continue;
    const list = byName.get(m.name) ?? [];
    list.push(m.code);
    byName.set(m.name, list);
  }
  return byName;
}

/** A counts unique names (same-name multi-pref excluded); D counts codes. */
export function coverageRate(
  mode: GameMode,
  region: string,
  difficulty: string,
  master: readonly MasterEntry[],
  cleared: ReadonlySet<string>,
): { total: number; cleared: number; rate: number } {
  if (mode === 'A') {
    const units = aNameUnits(master, region, difficulty);
    let n = 0;
    for (const codes of units.values()) {
      if (codes.some((c) => cleared.has(c))) n++;
    }
    const total = units.size;
    return { total, cleared: n, rate: total === 0 ? 1 : n / total };
  }
  const codes = master
    .filter((m) => m.region === region && m.difficulty === difficulty)
    .map((m) => m.code);
  const n = codes.filter((c) => cleared.has(c)).length;
  const total = codes.length;
  return { total, cleared: n, rate: total === 0 ? 1 : n / total };
}

export function computeModeCellCoverages(
  master: ReadonlyArray<MasterEntry>,
  clearedByMode: ReadonlyMap<GameMode, ReadonlySet<string>>,
): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const mode of ['A', 'D'] as const) {
    const cleared = clearedByMode.get(mode) ?? new Set();
    for (const region of REGION_VALUES) {
      if (mode === 'A' && region === '北海道') continue;
      for (const difficulty of DIFFICULTY_ORDER) {
        const { total, cleared: n, rate } = coverageRate(mode, region, difficulty, master, cleared);
        cells.push({ mode, region, difficulty, total, cleared: n, rate });
      }
    }
  }
  return cells;
}
