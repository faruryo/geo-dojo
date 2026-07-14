import { describe, it, expect } from 'vitest';
import { buildReviewQuestions } from '@/lib/quiz/review-questions';
import type { Municipality } from '@/lib/quiz/municipality-data';
import type { DueReviewItem } from '@/app/(app)/quiz/review/actions';

function muni(code: string, name: string, prefecture: string, region: string): Municipality {
  return { code, name, prefecture, region, difficulty: 'medium' };
}

function item(
  municipalityCode: string,
  municipalityName: string,
  prefecture: string,
  mode: 'A' | 'B' | 'C' | 'D',
): DueReviewItem {
  return { municipalityCode, municipalityName, prefecture, mode, interval: 1, dueDate: '2026-01-01' };
}

const CHUO_HOKKAIDO = muni('M1', '中央市', '北海道', '北海道');
const CHUO_TOKYO = muni('M2', '中央市', '東京都', '関東');
const OSAKA = muni('M3', '大阪市', '大阪府', '近畿');
const KOBE = muni('M4', '神戸市', '兵庫県', '近畿');
const KYOTO = muni('M5', '京都市', '京都府', '近畿');
const NARA = muni('M6', '奈良市', '奈良県', '近畿');

const ALL_MUNICIPALITIES: Municipality[] = [CHUO_HOKKAIDO, CHUO_TOKYO, OSAKA, KOBE, KYOTO, NARA];

describe('buildReviewQuestions', () => {
  it('items が空なら空配列を返す', () => {
    expect(buildReviewQuestions([], ALL_MUNICIPALITIES)).toEqual([]);
  });

  it('Mode A: 同名の複数県にまたがる市区町村を1問に集約する', () => {
    const items = [
      item('M1', '中央市', '北海道', 'A'),
      item('M2', '中央市', '東京都', 'A'),
    ];
    const qs = buildReviewQuestions(items, ALL_MUNICIPALITIES);
    expect(qs).toHaveLength(1);
    const q = qs[0];
    if (q.kind !== 'A') throw new Error('expected kind A');
    expect(q.name).toBe('中央市');
    expect(q.instances).toHaveLength(2);
    expect(q.correctPrefectures).toEqual(new Set(['北海道', '東京都']));
  });

  it('Mode B: 正解を含み重複のない4択を生成する', () => {
    const items = [item('M3', '大阪市', '大阪府', 'B')];
    const qs = buildReviewQuestions(items, ALL_MUNICIPALITIES);
    expect(qs).toHaveLength(1);
    const q = qs[0];
    if (q.kind !== 'BCD') throw new Error('expected kind BCD');
    expect(q.mode).toBe('B');
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices).toContain('大阪府');
  });

  it('Mode C/D: 正解を含み重複のない4択を生成する', () => {
    const items = [item('M3', '大阪市', '大阪府', 'C')];
    const qs = buildReviewQuestions(items, ALL_MUNICIPALITIES);
    expect(qs).toHaveLength(1);
    const q = qs[0];
    if (q.kind !== 'BCD') throw new Error('expected kind BCD');
    expect(q.mode).toBe('C');
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices).toContain('大阪市');
  });

  it('同一 (municipalityCode, mode) の重複 items は1問に de-dupe する', () => {
    const items = [
      item('M3', '大阪市', '大阪府', 'B'),
      item('M3', '大阪市', '大阪府', 'B'),
    ];
    const qs = buildReviewQuestions(items, ALL_MUNICIPALITIES);
    expect(qs).toHaveLength(1);
  });

  it('同一コードでも mode が異なれば別問題として扱う', () => {
    const items = [
      item('M3', '大阪市', '大阪府', 'B'),
      item('M3', '大阪市', '大阪府', 'C'),
    ];
    const qs = buildReviewQuestions(items, ALL_MUNICIPALITIES);
    expect(qs).toHaveLength(2);
  });
});
