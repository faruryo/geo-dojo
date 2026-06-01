import { describe, it, expect } from 'vitest';
import { dedupeInstancesByPrefecture, type Municipality } from '@/lib/quiz/municipality-data';

function muni(code: string, name: string, prefecture: string): Municipality {
  return { code, name, prefecture, region: '' };
}

describe('dedupeInstancesByPrefecture (B007)', () => {
  it('政令市（同名の区が複数コード）は1県=1件に畳む', () => {
    // 札幌市: 10区が全て name='札幌市' / 北海道
    const sapporo = Array.from({ length: 10 }, (_, i) => muni(`011${i}`, '札幌市', '北海道'));
    const reps = dedupeInstancesByPrefecture(sapporo);
    expect(reps).toHaveLength(1);
    expect(reps[0].prefecture).toBe('北海道');
    expect(reps[0].name).toBe('札幌市');
  });

  it('同名が複数県にある場合は県ごとに1件ずつ残す（府中市=東京/広島）', () => {
    const fuchu = [
      muni('13206', '府中市', '東京都'),
      muni('34208', '府中市', '広島県'),
    ];
    const reps = dedupeInstancesByPrefecture(fuchu);
    expect(reps).toHaveLength(2);
    expect(reps.map((r) => r.prefecture).sort()).toEqual(['広島県', '東京都']);
  });

  it('単一インスタンスはそのまま1件', () => {
    const reps = dedupeInstancesByPrefecture([muni('23211', '豊田市', '愛知県')]);
    expect(reps).toHaveLength(1);
  });

  it('複数県×政令市の混在: 県ごとに1件（政令市側も畳む）', () => {
    // 仮想ケース: 同名 X が A県に3区 + B県に1件
    const items = [
      muni('1', 'X市', 'A県'),
      muni('2', 'X市', 'A県'),
      muni('3', 'X市', 'A県'),
      muni('4', 'X市', 'B県'),
    ];
    const reps = dedupeInstancesByPrefecture(items);
    expect(reps).toHaveLength(2);
    expect(reps.map((r) => r.prefecture).sort()).toEqual(['A県', 'B県']);
  });

  it('空配列は空', () => {
    expect(dedupeInstancesByPrefecture([])).toEqual([]);
  });
});
