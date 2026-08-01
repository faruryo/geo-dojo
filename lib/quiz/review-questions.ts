import type { DueReviewItem } from '@/app/(app)/quiz/review/actions';
import type { Question } from '@/components/quiz/quiz-runner';
import {
  type Municipality,
  type Region,
  ALL_PREFECTURES,
  buildModeCDistractors,
  filterSameName,
  getRegionsPrefectures,
  shuffle,
} from '@/lib/quiz/municipality-data';

export function buildReviewQuestions(
  items: DueReviewItem[],
  allMunicipalities: Municipality[],
): Question[] {
  // モード混在 Question[] を組み立てる（出題順は期日優先順のまま）
  const seenInSession = new Set<string>();
  const qs: Question[] = [];

  // Mode A: 同じ name を持つ due コードをグルーピング
  const modeANames = new Set<string>();

  for (const it of items) {
    const sessionKey = `${it.municipalityCode}::${it.mode}`;
    if (seenInSession.has(sessionKey)) continue;
    seenInSession.add(sessionKey);

    if (it.mode === 'A') {
      const municipality = allMunicipalities.find((m) => m.code === it.municipalityCode);
      const name = municipality?.name ?? it.municipalityName;
      if (modeANames.has(name)) continue;
      modeANames.add(name);
      const allInstances = allMunicipalities.filter((m) => m.name === name);
      qs.push({
        kind: 'A',
        name,
        instances: allInstances,
        correctPrefectures: new Set(allInstances.map((m) => m.prefecture)),
      });
    } else {
      const municipality = allMunicipalities.find((m) => m.code === it.municipalityCode);
      if (!municipality) continue;

      const mode = it.mode as 'B' | 'C' | 'D';
      if (mode === 'B') {
        const prefPool = ALL_PREFECTURES;
        const distractors = shuffle(prefPool.filter((p) => p !== municipality.prefecture)).slice(0, 3);
        const choices = shuffle([municipality.prefecture, ...distractors]);
        qs.push({ kind: 'BCD', mode: 'B', municipality, choices });
      } else {
        // Mode C/D
        const regionPrefs = getRegionsPrefectures([municipality.region as Region]);
        const pool = filterSameName(allMunicipalities);
        const distractors = buildModeCDistractors(municipality, pool, {
          regionPrefs,
        });
        const choices = shuffle([municipality.name, ...distractors]);
        qs.push({ kind: 'BCD', mode, municipality, choices });
      }
    }
  }

  return qs;
}
