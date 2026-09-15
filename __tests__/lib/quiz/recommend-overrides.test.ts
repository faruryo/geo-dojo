import { describe, expect, it } from 'vitest';
import {
  activeOverridesForSession,
  reconcileStoredOverrides,
  recommendSessionKey,
  resolveRecommendStartParams,
  type RecommendOverrides,
  type RecommendSource,
} from '@/lib/quiz/recommendation/overrides';

const chinaA: RecommendSource = {
  mode: 'A',
  count: 10,
  regions: ['中国'],
  difficulties: ['easy'],
};

const tohokuB: RecommendOverrides = {
  mode: 'B',
  count: 10,
  targetRegions: ['東北'],
  difficulties: ['easy'],
};

describe('resolveRecommendStartParams', () => {
  it('未操作なら推薦エンジンの地方・モード・難易度をそのまま使う', () => {
    expect(resolveRecommendStartParams(chinaA, null)).toEqual({
      mode: 'A',
      count: 10,
      regions: ['中国'],
      difficulties: ['easy'],
    });
  });

  it('明示オーバーライドがあるときだけ開始パラメータを差し替える', () => {
    expect(resolveRecommendStartParams(chinaA, tohokuB)).toEqual({
      mode: 'B',
      count: 10,
      regions: ['東北'],
      difficulties: ['easy'],
    });
  });

  it('オーバーライドの対象地域が空なら全国（フィルタなし）として扱う', () => {
    expect(
      resolveRecommendStartParams(chinaA, {
        ...tohokuB,
        targetRegions: [],
      }),
    ).toEqual({
      mode: 'B',
      count: 10,
      regions: [],
      difficulties: ['easy'],
    });
  });
});

describe('recommendSessionKey / activeOverridesForSession', () => {
  it('推薦のモード・地方が変わったら別セッションとみなす', () => {
    expect(recommendSessionKey(chinaA)).not.toBe(
      recommendSessionKey({
        ...chinaA,
        mode: 'B',
        regions: ['東北'],
      }),
    );
  });

  it('古い推薦に対するオーバーライドは新しい推薦へ持ち越さない', () => {
    const stored = {
      sessionKey: recommendSessionKey({
        mode: 'B',
        count: 10,
        regions: ['関東'],
        difficulties: ['easy'],
      }),
      value: tohokuB,
    };

    expect(activeOverridesForSession(stored, recommendSessionKey(chinaA))).toBeNull();
    expect(
      activeOverridesForSession(stored, stored.sessionKey),
    ).toEqual(tohokuB);
    expect(reconcileStoredOverrides(stored, recommendSessionKey(chinaA))).toBeNull();
    expect(reconcileStoredOverrides(stored, stored.sessionKey)).toBe(stored);
  });
});
