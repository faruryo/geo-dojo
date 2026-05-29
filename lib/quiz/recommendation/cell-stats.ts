import type { Session, CellAccuracy, Cell, CellCoverage } from './types';
import { cellKey, REGION_VALUES, DIFFICULTY_ORDER } from './types';

type RawRow = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: string;
  isCorrect: boolean;
  answeredAt: Date;
  region?: string;
  difficulty?: string;
};

type MasterEntry = {
  code: string;
  region: string;
  difficulty: string;
};

export function inferSessions(rows: RawRow[]): Session[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
  const groups: RawRow[][] = [];
  let current: RawRow[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const sameMode = curr.mode === prev.mode;
    const withinWindow = curr.answeredAt.getTime() - prev.answeredAt.getTime() <= 30 * 60 * 1000;
    if (sameMode && withinWindow) {
      current.push(curr);
    } else {
      groups.push(current);
      current = [curr];
    }
  }
  groups.push(current);

  const sessions: Session[] = [];
  for (const group of groups) {
    const count = group.length;
    if (count !== 10 && count !== 20 && count !== 30) continue;
    const correct = group.filter((r) => r.isCorrect).length;
    sessions.push({
      startAt: group[0].answeredAt,
      endAt: group[group.length - 1].answeredAt,
      mode: group[0].mode as Session['mode'],
      rows: group,
      accuracy: correct / count,
      count: count as 10 | 20 | 30,
    });
  }
  return sessions;
}

export function computeCellAccuracies(
  sessions: Session[],
  masterMap: Map<string, MasterEntry>,
  crowdAccuracyByDifficulty: Record<string, number>,
): Map<string, CellAccuracy> {
  const cellSessions = new Map<string, Session[]>();

  for (const session of sessions) {
    const dist = new Map<string, number>();
    for (const row of session.rows) {
      const master = masterMap.get(row.municipalityCode);
      if (!master) continue;
      const region = master.region;
      const difficulty = master.difficulty;
      const k = `${difficulty}_${region}_${session.mode}`;
      dist.set(k, (dist.get(k) ?? 0) + 1);
    }
    const total = session.rows.length;
    for (const [k, cnt] of dist) {
      if (cnt / total >= 0.5) {
        const arr = cellSessions.get(k) ?? [];
        arr.push(session);
        cellSessions.set(k, arr);
      }
    }
  }

  const allCells = new Set<string>();
  for (const sessions of cellSessions.values()) {
    for (const s of sessions) {
      for (const row of s.rows) {
        const master = masterMap.get(row.municipalityCode);
        if (!master) continue;
        const k = cellKey({ difficulty: master.difficulty as Cell['difficulty'], region: master.region as Cell['region'], mode: s.mode as Cell['mode'] });
        allCells.add(k);
      }
    }
  }
  // Also add all explicit cell entries
  for (const k of cellSessions.keys()) allCells.add(k);

  const allSessionsList = sessions;
  const overallAccuracy = allSessionsList.length > 0
    ? allSessionsList.reduce((a, s) => a + s.accuracy, 0) / allSessionsList.length
    : 0.5;

  const result = new Map<string, CellAccuracy>();

  const parseKey = (k: string): Cell | null => {
    const parts = k.split('_');
    if (parts.length < 3) return null;
    const mode = parts[parts.length - 1] as Cell['mode'];
    const difficulty = parts[0] as Cell['difficulty'];
    const region = parts.slice(1, -1).join('_') as Cell['region'];
    return { difficulty, region, mode };
  };

  for (const k of allCells) {
    const cell = parseKey(k);
    if (!cell) continue;

    const sessionsForCell = cellSessions.get(k) ?? [];
    const sorted = [...sessionsForCell].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const window5 = sorted.slice(-5);
    const sessionCount = sorted.length;

    if (window5.length >= 3) {
      const avg = window5.reduce((a, s) => a + s.accuracy, 0) / window5.length;
      result.set(k, {
        cell,
        movingAverage: avg,
        sessionCount,
        windowSessions: window5,
        source: 'self',
      });
    } else {
      // Backoff
      // difficulty-mode: same mode × same difficulty, all regions
      const diffModeSessions = allSessionsList.filter((s) => {
        const dominant = getDominantCell(s, masterMap);
        return dominant && dominant.mode === cell.mode && dominant.difficulty === cell.difficulty;
      });

      // mode: same mode, all difficulties
      const modeSessions = allSessionsList.filter((s) => {
        const dominant = getDominantCell(s, masterMap);
        return dominant && dominant.mode === cell.mode;
      });

      let movingAverage: number;
      let source: CellAccuracy['source'];

      if (diffModeSessions.length >= 1) {
        const window = diffModeSessions.slice(-5);
        movingAverage = window.reduce((a, s) => a + s.accuracy, 0) / window.length;
        source = 'difficulty-mode';
      } else if (modeSessions.length >= 1) {
        const window = modeSessions.slice(-5);
        movingAverage = window.reduce((a, s) => a + s.accuracy, 0) / window.length;
        source = 'mode';
      } else if (allSessionsList.length >= 1) {
        movingAverage = overallAccuracy;
        source = 'overall';
      } else {
        movingAverage = crowdAccuracyByDifficulty[cell.difficulty] ?? 0.5;
        source = 'crowd-average';
      }

      result.set(k, {
        cell,
        movingAverage,
        sessionCount,
        windowSessions: window5,
        source,
      });
    }
  }

  // Initialize cells from crowd average if completely unplayed
  if (result.size === 0) {
    for (const region of REGION_VALUES) {
      for (const difficulty of DIFFICULTY_ORDER) {
        for (const mode of ['A', 'B', 'C', 'D'] as Cell['mode'][]) {
          const cell: Cell = { difficulty, region, mode };
          const k = cellKey(cell);
          if (!result.has(k)) {
            result.set(k, {
              cell,
              movingAverage: crowdAccuracyByDifficulty[difficulty] ?? 0.5,
              sessionCount: 0,
              windowSessions: [],
              source: 'crowd-average',
            });
          }
        }
      }
    }
  }

  return result;
}

function getDominantCell(
  session: Session,
  masterMap: Map<string, MasterEntry>,
): { mode: string; difficulty: string; region: string } | null {
  const dist = new Map<string, number>();
  for (const row of session.rows) {
    const master = masterMap.get(row.municipalityCode);
    if (!master) continue;
    const k = `${master.difficulty}_${master.region}_${session.mode}`;
    dist.set(k, (dist.get(k) ?? 0) + 1);
  }
  const total = session.rows.length;
  for (const [k, cnt] of dist) {
    if (cnt / total >= 0.5) {
      const parts = k.split('_');
      return {
        difficulty: parts[0],
        region: parts.slice(1, -1).join('_'),
        mode: parts[parts.length - 1],
      };
    }
  }
  return null;
}

export function computeCellCoverages(
  masterEntries: MasterEntry[],
  correctCodesByUser: Set<string>,
): Map<string, CellCoverage> {
  const byCell = new Map<string, { total: string[]; conquered: string[] }>();

  for (const m of masterEntries) {
    for (const mode of ['A', 'B', 'C', 'D'] as Cell['mode'][]) {
      const cell: Cell = {
        difficulty: m.difficulty as Cell['difficulty'],
        region: m.region as Cell['region'],
        mode,
      };
      const k = cellKey(cell);
      const entry = byCell.get(k) ?? { total: [], conquered: [] };
      entry.total.push(m.code);
      if (correctCodesByUser.has(m.code)) entry.conquered.push(m.code);
      byCell.set(k, entry);
    }
  }

  const result = new Map<string, CellCoverage>();
  for (const [k, { total, conquered }] of byCell) {
    const parts = k.split('_');
    const mode = parts[parts.length - 1] as Cell['mode'];
    const difficulty = parts[0] as Cell['difficulty'];
    const region = parts.slice(1, -1).join('_') as Cell['region'];
    result.set(k, {
      cell: { difficulty, region, mode },
      totalMunicipalities: total.length,
      conqueredCount: conquered.length,
      coverageRate: total.length > 0 ? conquered.length / total.length : 0,
    });
  }
  return result;
}
