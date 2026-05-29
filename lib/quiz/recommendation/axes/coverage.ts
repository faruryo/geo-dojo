import type { FitZone, Cell } from '../types';
import { cellKey } from '../types';

type MasterEntry = { code: string; region: string; difficulty: string };

export function selectCoverageCodes(
  fitZone: FitZone,
  allMaster: MasterEntry[],
  playedCodes: Set<string>,
  recentPlayedCodes: Set<string>,
  count: number,
): string[] {
  const fitCellKeys = new Set(fitZone.cells.map((ca) => cellKey(ca.cell)));

  // Collect unplayed codes within Fit Zone cells
  const unplayed: string[] = [];
  for (const m of allMaster) {
    for (const mode of ['A', 'B', 'C', 'D'] as Cell['mode'][]) {
      const k = `${m.difficulty}_${m.region}_${mode}`;
      if (fitCellKeys.has(k) && !playedCodes.has(m.code)) {
        unplayed.push(m.code);
        break;
      }
    }
  }

  if (unplayed.length >= count) {
    return unplayed.slice(0, count);
  }

  // Pool exhausted: fall back to codes not played in last 30 days
  const fallback: string[] = [];
  for (const m of allMaster) {
    for (const mode of ['A', 'B', 'C', 'D'] as Cell['mode'][]) {
      const k = `${m.difficulty}_${m.region}_${mode}`;
      if (fitCellKeys.has(k) && !recentPlayedCodes.has(m.code)) {
        fallback.push(m.code);
        break;
      }
    }
  }

  const combined = [...new Set([...unplayed, ...fallback])];
  return combined.slice(0, count);
}
