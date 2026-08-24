import { describe, expect, it } from 'vitest';
import { isRecommendAutoStartReady, type RecommendAutoStartInput } from '@/lib/quiz/recommend-auto-start';

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
