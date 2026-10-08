type QuizModeFilter = 'all' | 'A' | 'B' | 'C' | 'D';

export interface RawCompletionRow {
  date: unknown;
  difficulty: string | null;
  municipalityCode: string;
  municipalityName: string | null;
  prefecture: string | null;
  mode: string;
}

const DIFFS = ['easy', 'medium', 'hard', 'expert'] as const;

type CompletionEntry = { mode: string; code: string; name: string; prefecture: string };

function getCompletionEntryKey(mode: QuizModeFilter, entry: CompletionEntry) {
  if (mode === 'all') {
    if (entry.mode === 'A') return `A:${entry.name}`;
    if (entry.mode === 'B' || entry.mode === 'C') return `${entry.mode}:${entry.name}::${entry.prefecture}`;
    return `D:${entry.code}`;
  }
  if (mode === 'A') return entry.name;
  if (mode === 'B' || mode === 'C') return `${entry.name}::${entry.prefecture}`;
  return entry.code;
}

function updateCumSets(
  diffMap: Map<string, CompletionEntry[]>,
  cumSets: Map<string, Set<string>>,
  mode: QuizModeFilter,
) {
  for (const diff of DIFFS) {
    const entries = diffMap.get(diff);
    if (!entries) continue;
    const set = cumSets.get(diff);
    if (!set) continue;
    for (const entry of entries) {
      set.add(getCompletionEntryKey(mode, entry));
    }
  }
}

function snapshotRow(
  dateStr: string,
  cumSets: Map<string, Set<string>>,
  diffTotals: Map<string, number>,
  totalAllSlots: number,
) {
  let cumAllCount = 0;
  const rowValues = DIFFS.map((diff) => {
    const cumCount = cumSets.get(diff)?.size ?? 0;
    const total = diffTotals.get(diff) ?? 1;
    const val = Math.round((cumCount / total) * 10000) / 100;
    cumAllCount += cumCount;
    return [diff, val] as const;
  });
  const row: Record<string, unknown> = Object.fromEntries(rowValues);
  row.date = dateStr;
  row.all = totalAllSlots > 0 ? Math.round((cumAllCount / totalAllSlots) * 10000) / 100 : 0;
  return row;
}

function groupRowsByDate(rows: RawCompletionRow[]) {
  const dateMap = new Map<string, Map<string, CompletionEntry[]>>();
  for (const r of rows) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    const diff = r.difficulty ?? 'unknown';
    let diffMap = dateMap.get(dateStr);
    if (!diffMap) {
      diffMap = new Map();
      dateMap.set(dateStr, diffMap);
    }
    let list = diffMap.get(diff);
    if (!list) {
      list = [];
      diffMap.set(diff, list);
    }
    list.push({
      mode: r.mode,
      code: r.municipalityCode,
      name: r.municipalityName || '',
      prefecture: r.prefecture || '',
    });
  }
  return dateMap;
}

export function buildCompletionDailyTrend(
  rows: RawCompletionRow[],
  mode: QuizModeFilter,
  diffTotals: Map<string, number>,
  totalAllSlots: number,
  periodStart: Date | null,
) {
  const dateMap = groupRowsByDate(rows);

  const cumSets = new Map<string, Set<string>>(DIFFS.map((d) => [d, new Set()]));
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));
  const dailyData: Record<string, unknown>[] = [];
  const cutoff = periodStart ? periodStart.toISOString().slice(0, 10) : null;

  for (const dateStr of sortedDates) {
    const diffMap = dateMap.get(dateStr);
    if (diffMap) updateCumSets(diffMap, cumSets, mode);
    if (cutoff && dateStr < cutoff) continue;
    dailyData.push(snapshotRow(dateStr, cumSets, diffTotals, totalAllSlots));
  }

  // 期間内の正解が無くても、2日以上の履歴なら累積率を1点残す。
  if (dailyData.length === 0 && sortedDates.length >= 2 && cutoff) {
    dailyData.push(snapshotRow(cutoff, cumSets, diffTotals, totalAllSlots));
  }

  return dailyData;
}
