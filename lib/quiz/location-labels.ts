import wardNames from '@/lib/quiz/data/designated-city-ward-names.json';

const WARD_LABELS = new Map(Object.entries(wardNames));

export function locationLabel(code: string, fallbackName: string): string {
  return WARD_LABELS.get(code) ?? fallbackName;
}
