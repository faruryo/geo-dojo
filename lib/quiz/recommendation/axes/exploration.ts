import type { CellAccuracy, CellCoverage, FitZone, Cell } from '../types';
import { cellKey } from '../types';

type MasterEntry = { code: string; region: string; difficulty: string };

export function selectExplorationPool(
  allMaster: MasterEntry[],
  cellAccuracies: Map<string, CellAccuracy>,
  cellCoverages: Map<string, CellCoverage>,
  fitZone: FitZone,
): string[] {
  const fitCellKeys = new Set(fitZone.cells.map((ca) => cellKey(ca.cell)));

  // Find unplayed or low-coverage cells (bottom 25% coverageRate)
  const allCoverages = [...cellCoverages.values()];
  const sorted = [...allCoverages].sort((a, b) => a.coverageRate - b.coverageRate);
  const threshold25 = sorted[Math.floor(sorted.length * 0.25)]?.coverageRate ?? 0;

  const explorationCellKeys = new Set<string>();
  for (const cv of allCoverages) {
    const k = cellKey(cv.cell);
    if (!fitCellKeys.has(k) && cv.coverageRate <= threshold25) {
      explorationCellKeys.add(k);
    }
    if (!fitCellKeys.has(k) && cv.coverageRate === 0) {
      explorationCellKeys.add(k);
    }
  }

  // Collect municipality codes from exploration cells
  const pool: string[] = [];
  for (const m of allMaster) {
    for (const mode of ['A', 'B', 'C', 'D'] as Cell['mode'][]) {
      const k = `${m.difficulty}_${m.region}_${mode}`;
      if (explorationCellKeys.has(k)) {
        pool.push(m.code);
        break;
      }
    }
  }

  return [...new Set(pool)];
}
