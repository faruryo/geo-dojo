import wardNames from '@/lib/quiz/data/designated-city-ward-names.json';
import wardKanas from '@/lib/quiz/data/designated-city-ward-kana.json';

const WARD_LABELS = new Map(Object.entries(wardNames));
const WARD_KANAS = new Map(Object.entries(wardKanas));

export function locationLabel(code: string, fallbackName: string): string {
  return WARD_LABELS.get(code) ?? fallbackName;
}

export function locationKana(code: string, fallbackKana?: string): string | undefined {
  return WARD_KANAS.get(code) ?? fallbackKana;
}

/** Mode D だけ政令市の区名にする。他モードは保存名のまま。 */
export function locationForMode(
  mode: string,
  code: string,
  name: string,
  kana?: string | null,
): { name: string; kana?: string } {
  if (mode !== 'D') return { name, kana: kana ?? undefined };
  return {
    name: locationLabel(code, name),
    kana: locationKana(code, kana ?? undefined),
  };
}
