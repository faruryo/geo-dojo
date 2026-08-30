import type { Question } from '@/components/quiz/use-quiz-session';
import {
  type Difficulty,
  type GameMode,
  type Municipality,
  type Region,
  type SessionCount,
  ALL_PREFECTURES,
  buildModeCDistractors,
  filterByDifficulty,
  filterByRegions,
  filterTextModeMunicipalities,
  getRegionsPrefectures,
  shuffle,
} from '@/lib/quiz/municipality-data';
import {
  sampleMunicipalityPool,
  type IdentityCodeMap,
  type MunicipalityWeakness,
} from '@/lib/quiz/sampling';

export interface MunicipalityQuizSettings {
  mode: GameMode;
  regions: Region[];
  count: SessionCount;
  unclearedFirst: boolean;
  weaknessFirst: boolean;
  difficulties: Difficulty[];
}

function buildModeAQuestions(
  pool: Municipality[],
  all: Municipality[],
  count: number,
): Question[] {
  const seen = new Set<string>();
  const questions: Question[] = [];
  for (const m of pool) {
    if (questions.length >= count) break;
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    const instances = all.filter((a) => a.name === m.name);
    questions.push({
      kind: 'A',
      name: m.name,
      instances,
      correctPrefectures: new Set(instances.map((i) => i.prefecture)),
    });
  }
  return questions;
}

function buildBCDQuestions(
  pool: Municipality[],
  source: Municipality[],
  settings: MunicipalityQuizSettings,
): Question[] {
  const seen = new Set<string>();
  const deduped = pool.filter((m) => {
    const key = settings.mode === 'D' ? m.code : `${m.name}::${m.prefecture}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const sliced = deduped.slice(0, settings.count);
  const regionPrefs = getRegionsPrefectures(settings.regions);

  return sliced.map((m): Question => {
    if (settings.mode === 'B') {
      const prefPool = regionPrefs.length >= 4 ? regionPrefs : ALL_PREFECTURES;
      const distractors = shuffle(prefPool.filter((p) => p !== m.prefecture)).slice(0, 3);
      const choices = shuffle([m.prefecture, ...distractors]);
      return { kind: 'BCD', mode: 'B', municipality: m, choices };
    }
    const distractors = buildModeCDistractors(m, source, {
      regionPrefs,
      targetDifficulties: settings.difficulties,
    });
    const choices = shuffle([m.name, ...distractors]);
    return { kind: 'BCD', mode: settings.mode as 'C' | 'D', municipality: m, choices };
  });
}

export function buildMunicipalityQuestions(
  all: Municipality[],
  settings: MunicipalityQuizSettings,
  weaknessMap: Map<string, MunicipalityWeakness>,
  clearedCodes: Set<string>,
  identityCodeMap: IdentityCodeMap,
  random?: () => number,
): Question[] {
  const isTextMode = settings.mode === 'A' || settings.mode === 'B' || settings.mode === 'C';
  const source = isTextMode ? filterTextModeMunicipalities(all) : all;
  const byRegion = filterByRegions(source, settings.regions);
  const filtered = filterByDifficulty(byRegion, settings.difficulties);

  const sampledItems = sampleMunicipalityPool(filtered, {
    count: settings.count,
    mode: settings.mode,
    unclearedFirst: settings.unclearedFirst,
    weaknessFirst: settings.weaknessFirst,
    clearedCodes,
    weaknessMap,
    identityCodeMap,
    random,
  });

  if (settings.mode === 'A') {
    return buildModeAQuestions(sampledItems, all, settings.count);
  }

  return buildBCDQuestions(sampledItems, source, settings);
}
