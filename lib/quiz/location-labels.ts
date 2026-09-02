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
