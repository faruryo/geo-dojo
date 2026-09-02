import { describe, it, expect } from 'vitest';
import {
  buildMunicipalityQuestions,
  resolveQuizScope,
} from '@/lib/quiz/municipality-questions';
import { buildIdentityCodeMap, type MunicipalityWeakness } from '@/lib/quiz/sampling';
import type { Municipality } from '@/lib/quiz/municipality-data';

const mockMunicipalities: Municipality[] = [
  { code: '20201', name: '長野市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
  { code: '20202', name: '松本市', prefecture: '長野県', region: '中部', difficulty: 'easy' },
  { code: '20203', name: '上田市', prefecture: '長野県', region: '中部', difficulty: 'medium' },
  { code: '20204', name: '岡谷市', prefecture: '長野県', region: '中部', difficulty: 'hard' },
  { code: '13101', name: '千代田区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
  { code: '13102', name: '中央区', prefecture: '東京都', region: '関東', difficulty: 'easy' },
  { code: '27100', name: '大阪市', prefecture: '大阪府', region: '近畿', difficulty: 'easy' },
];

const identityCodeMap = buildIdentityCodeMap(mockMunicipalities);
const emptyWeaknessMap = new Map<string, MunicipalityWeakness>();
const emptyClearedCodes = new Set<string>();

describe('resolveQuizScope', () => {
  it('scope が指定されている場合は scope をそのまま返す', () => {
    const scope = resolveQuizScope({
      mode: 'D',
      scope: { type: 'prefecture', prefecture: '長野県' },
      count: 10,
      unclearedFirst: true,
      weaknessFirst: false,
      difficulties: ['easy', 'medium'],
    });
    expect(scope).toEqual({ type: 'prefecture', prefecture: '長野県' });
  });

  it('scope が未指定で regions が指定されている場合は regions を含む region スコープを返す', () => {
    const scope = resolveQuizScope({
      mode: 'D',
      regions: ['中部'],
      count: 10,
      unclearedFirst: true,
      weaknessFirst: false,
      difficulties: ['easy'],
    });
    expect(scope).toEqual({ type: 'region', regions: ['中部'] });
  });
});

describe('buildMunicipalityQuestions with Scope', () => {
  it('Mode D で都道府県スコープを指定した場合、指定都道府県の自治体のみから出題される', () => {
    const questions = buildMunicipalityQuestions(
      mockMunicipalities,
      {
        mode: 'D',
        scope: { type: 'prefecture', prefecture: '長野県' },
        count: 10,
        unclearedFirst: false,
        weaknessFirst: false,
        difficulties: ['easy', 'medium', 'hard'],
      },
      emptyWeaknessMap,
      emptyClearedCodes,
      identityCodeMap,
    );

    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      if (q.kind === 'BCD') {
        expect(q.mode).toBe('D');
        expect(q.municipality.prefecture).toBe('長野県');
      } else {
        throw new Error('Expected BCD question for Mode D');
      }
    }
  });

  it('Mode D で個別自治体コード（selectedCodes）を指定した場合、指定コードのみから出題される', () => {
    const questions = buildMunicipalityQuestions(
      mockMunicipalities,
      {
        mode: 'D',
        scope: { type: 'prefecture', prefecture: '長野県', selectedCodes: ['20202'] },
        count: 10,
        unclearedFirst: false,
        weaknessFirst: false,
        difficulties: ['easy', 'medium', 'hard'],
      },
      emptyWeaknessMap,
      emptyClearedCodes,
      identityCodeMap,
    );

    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      if (q.kind === 'BCD') {
        expect(q.municipality.code).toBe('20202');
        expect(q.municipality.name).toBe('松本市');
      }
    }
  });

  it('指定プールが問題数（10問）未満でもエラーにならずプール全件から出題が生成される', () => {
    const questions = buildMunicipalityQuestions(
      mockMunicipalities,
      {
        mode: 'D',
        scope: { type: 'prefecture', prefecture: '長野県', selectedCodes: ['20201', '20202'] },
        count: 10,
        unclearedFirst: false,
        weaknessFirst: false,
        difficulties: ['easy'],
      },
      emptyWeaknessMap,
      emptyClearedCodes,
      identityCodeMap,
    );

    // When pool size (2) < count (10), questions has 2 items without error
    expect(questions).toHaveLength(2);
    const names = questions.map((q) => (q.kind === 'BCD' ? q.municipality.name : ''));
    expect(names).toContain('長野市');
    expect(names).toContain('松本市');
  });
});
