import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Municipality } from '@/lib/quiz/municipality-data';
import {
  buildRecommendAutoStartQuestions,
  isQueryResultReady,
  isRecommendAutoStartReady,
  type RecommendAutoStartInput,
} from '@/lib/quiz/recommend-auto-start';
import { buildIdentityCodeMap } from '@/lib/quiz/sampling';
import type { MunicipalityQuizSettings } from '@/lib/quiz/municipality-questions';

function ready(overrides: Partial<RecommendAutoStartInput> = {}): RecommendAutoStartInput {
  return {
    isRecommendSource: true,
    alreadyStarted: false,
    phase: 'setup',
    masterReady: true,
    modeAvailable: true,
    unclearedFirst: true,
    clearedQuerySettledOk: true,
    weaknessFirst: false,
    weaknessQuerySettledOk: true,
    ...overrides,
  };
}

function muni(code: string, name: string): Municipality {
  return {
    code,
    name,
    prefecture: '神奈川県',
    region: '関東',
    difficulty: 'easy',
  };
}

describe('isRecommendAutoStartReady', () => {
  it('starts recommend sessions when unclearedFirst is on and cleared codes have loaded', () => {
    expect(isRecommendAutoStartReady(ready())).toBe(true);
  });

  it('does not auto-start while cleared codes are loading or failed if unclearedFirst is on', () => {
    expect(isRecommendAutoStartReady(ready({ clearedQuerySettledOk: false }))).toBe(false);
  });

  it('does not auto-start from a non-recommend entry', () => {
    expect(isRecommendAutoStartReady(ready({ isRecommendSource: false }))).toBe(false);
  });

  it('does not auto-start twice', () => {
    expect(isRecommendAutoStartReady(ready({ alreadyStarted: true }))).toBe(false);
  });

  it('waits for weakness query only when weaknessFirst is on', () => {
    expect(
      isRecommendAutoStartReady(
        ready({ weaknessFirst: true, weaknessQuerySettledOk: false }),
      ),
    ).toBe(false);
    expect(
      isRecommendAutoStartReady(
        ready({ weaknessFirst: false, weaknessQuerySettledOk: false }),
      ),
    ).toBe(true);
  });
});

describe('isQueryResultReady', () => {
  it('does not treat a paused pending query as ready', () => {
    const pausedPending = {
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: false,
      isPaused: true,
    };
    const legacySettled =
      !pausedPending.isLoading && !pausedPending.isFetching && !pausedPending.isError;
    expect(legacySettled).toBe(true);
    expect(isQueryResultReady(pausedPending)).toBe(false);
  });

  it('treats a successful idle query as ready even when data is an empty list', () => {
    expect(isQueryResultReady({ isSuccess: true, isFetching: false, isPaused: false })).toBe(true);
  });

  it('does not treat a background refetch of cached success as ready', () => {
    expect(isQueryResultReady({ isSuccess: true, isFetching: true, isPaused: false })).toBe(false);
  });

  it('does not treat a paused cached success as ready', () => {
    expect(isQueryResultReady({ isSuccess: true, isFetching: false, isPaused: true })).toBe(false);
  });
});

describe('buildRecommendAutoStartQuestions', () => {
  const cleared = Array.from({ length: 10 }, (_, i) =>
    muni(`c${String(i).padStart(2, '0')}`, `市${i}`),
  );
  const uncleared = muni('u01', '未クリア市');
  const allMunicipalities = [...cleared, uncleared];
  const identityCodeMap = buildIdentityCodeMap(allMunicipalities);
  const settings: MunicipalityQuizSettings = {
    mode: 'B',
    regions: ['関東'],
    count: 10,
    unclearedFirst: true,
    weaknessFirst: false,
    difficulties: ['easy'],
  };

  function bcdCodes(questions: ReturnType<typeof buildRecommendAutoStartQuestions>): string[] {
    return questions.flatMap((q) => (q.kind === 'BCD' ? [q.municipality.code] : []));
  }

  it('includes remaining uncleared municipalities when recommend auto-start has loaded cleared codes', () => {
    const questions = buildRecommendAutoStartQuestions({
      ...ready(),
      allMunicipalities,
      settings,
      weaknessMap: new Map(),
      clearedCodes: new Set(cleared.map((item) => item.code)),
      identityCodeMap,
      random: () => 0,
    });

    expect(bcdCodes(questions)).toContain('u01');
  });

  it('excludes the last uncleared municipality if unclearedFirst is forced off (the pre-fix recommend bypass)', () => {
    const questions = buildRecommendAutoStartQuestions({
      ...ready(),
      allMunicipalities,
      settings: { ...settings, unclearedFirst: false },
      weaknessMap: new Map(),
      clearedCodes: new Set(cleared.map((item) => item.code)),
      identityCodeMap,
      random: () => 0,
    });

    expect(bcdCodes(questions)).not.toContain('u01');
  });
});

describe('municipality quiz page recommend wiring', () => {
  it('starts recommend sessions through buildRecommendAutoStartQuestions without forcing unclearedFirst off', () => {
    const src = readFileSync(
      new URL('../../../app/(app)/quiz/municipality/[mode]/page.tsx', import.meta.url),
      'utf8',
    );
    expect(src).toContain('buildRecommendAutoStartQuestions');
    expect(src).toContain('isQueryResultReady');
    expect(src).not.toMatch(/unclearedFirst:\s*false/);
  });
});
