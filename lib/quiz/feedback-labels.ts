import {
  dedupeInstancesByPrefecture,
  type Municipality,
} from '@/lib/quiz/municipality-data';
import { locationLabel, locationKana } from '@/lib/quiz/location-labels';

export function withKana(name: string, kana: string | undefined): string {
  return kana ? `${name}（${kana}）` : name;
}

export function formatSingleFeedback(
  municipality: Municipality,
  mode: 'B' | 'C' | 'D',
  effectiveMode: 'B' | 'C' | 'D' = mode,
): string {
  if (mode === 'B') {
    return `${withKana(municipality.name, municipality.kana)} （正解: ${municipality.prefecture}）`;
  }
  const displayName =
    effectiveMode === 'D'
      ? locationLabel(municipality.code, municipality.name)
      : municipality.name;
  const displayKana =
    effectiveMode === 'D'
      ? locationKana(municipality.code, municipality.kana)
      : municipality.kana;
  return withKana(displayName, displayKana);
}

export function formatModeAFeedback(
  name: string,
  instances: Municipality[],
): string {
  const representatives = dedupeInstancesByPrefecture(instances);
  if (representatives.length === 0) return name;

  const prefectures = representatives.map((municipality) => municipality.prefecture);
  const knownKana = representatives
    .map((municipality) => municipality.kana)
    .filter((kana): kana is string => !!kana);

  if (knownKana.length === 0) {
    return `${name} （正解: ${prefectures.join('・')}）`;
  }

  const firstKana = knownKana[0];
  const allPrefecturesHaveSameKana = representatives.every(
    (municipality) => municipality.kana === firstKana,
  );
  if (allPrefecturesHaveSameKana) {
    return `${withKana(name, firstKana)} （正解: ${prefectures.join('・')}）`;
  }

  const prefecturesWithKana = representatives.map((municipality) =>
    municipality.kana
      ? `${municipality.prefecture}: ${municipality.kana}`
      : municipality.prefecture,
  );
  return `${name} （正解: ${prefecturesWithKana.join(' / ')}）`;
}
