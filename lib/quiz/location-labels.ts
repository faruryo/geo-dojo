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

/**
 * Mode D（場所当て）の行だけ区名・区の読みへ正規化する。
 * クイズ結果の保存名は政令市でも親市名のままなので、ダッシュボード等で
 * 表示する直前に適用する。Mode A/B/C は市単位の出題なので親市名が正しく、
 * 東京23区はマスター名が区名のためどちらでも表示は変わらない。
 */
export function wardAwareName(mode: string, code: string, name: string): string {
  return mode === 'D' ? locationLabel(code, name) : name;
}

export function wardAwareKana(mode: string, code: string, kana?: string): string | undefined {
  return mode === 'D' ? locationKana(code, kana) : kana;
}
