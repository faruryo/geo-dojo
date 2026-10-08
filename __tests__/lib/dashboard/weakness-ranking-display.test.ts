import { beforeEach, describe, expect, it, vi } from 'vitest';

type RankingRow = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: string;
  region: string;
  difficulty: string;
  kana: string | null;
  totalCount: number;
  errorCount: number;
  errorRate: number;
};

const { rankingRows } = vi.hoisted(() => ({
  rankingRows: [] as RankingRow[],
}));

vi.mock('@/lib/db', () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    having: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rankingRows),
  };
  return { db: chain };
});

import { getWeaknessRankingData } from '@/lib/db/queries/dashboard';

function row(
  partial: Pick<RankingRow, 'municipalityCode' | 'municipalityName' | 'mode' | 'kana'>,
): RankingRow {
  return {
    prefecture: '京都府',
    region: '近畿',
    difficulty: 'medium',
    totalCount: 2,
    errorCount: 2,
    errorRate: 1,
    ...partial,
  };
}

describe('getWeaknessRankingData location display', () => {
  beforeEach(() => {
    rankingRows.length = 0;
  });

  it('Mode D の政令市区は区名と区の読みで返し、他モードと東京23区は保存名のまま', async () => {
    rankingRows.push(
      row({ municipalityCode: '26103', municipalityName: '京都市', mode: 'D', kana: 'きょうとし' }),
      row({ municipalityCode: '26104', municipalityName: '京都市', mode: 'D', kana: 'きょうとし' }),
      row({ municipalityCode: '26103', municipalityName: '京都市', mode: 'A', kana: 'きょうとし' }),
      row({ municipalityCode: '13101', municipalityName: '千代田区', mode: 'D', kana: 'ちよだく' }),
    );

    const result = await getWeaknessRankingData('user-1');

    expect(result.map((item) => [item.mode, item.municipalityCode, item.municipalityName, item.kana])).toEqual([
      ['D', '26103', '京都市左京区', 'きょうとしさきょうく'],
      ['D', '26104', '京都市中京区', 'きょうとしなかぎょうく'],
      ['A', '26103', '京都市', 'きょうとし'],
      ['D', '13101', '千代田区', 'ちよだく'],
    ]);
  });
});
