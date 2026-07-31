import {
  dedupeInstancesByPrefecture,
  type Municipality,
} from '@/lib/quiz/municipality-data';

export function withKana(name: string, kana: string | undefined): string {
  return kana ? `${name}（${kana}）` : name;
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
