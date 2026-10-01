import { describe, it, expect } from 'vitest';
import { MAX_SNAPSHOT_KEYS, validateSrsSnapshotKeys } from '@/lib/quiz/srs/snapshot';

function keys(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    municipalityCode: String(10000 + i).padStart(5, '0'),
    mode: 'B',
  }));
}

describe('validateSrsSnapshotKeys', () => {
  it('正常なキーをそのまま返す', () => {
    expect(
      validateSrsSnapshotKeys([
        { municipalityCode: '01213', mode: 'A' },
        { municipalityCode: '07213', mode: 'A' },
      ]),
    ).toEqual([
      { municipalityCode: '01213', mode: 'A' },
      { municipalityCode: '07213', mode: 'A' },
    ]);
  });

  it('同一 code::mode の重複は1件に畳み、モード違いは別キーとして残す', () => {
    expect(
      validateSrsSnapshotKeys([
        { municipalityCode: '01213', mode: 'B' },
        { municipalityCode: '01213', mode: 'B' },
        { municipalityCode: '01213', mode: 'C' },
      ]),
    ).toEqual([
      { municipalityCode: '01213', mode: 'B' },
      { municipalityCode: '01213', mode: 'C' },
    ]);
  });

  it('余分なプロパティは返り値に含めない', () => {
    expect(validateSrsSnapshotKeys([{ municipalityCode: '01213', mode: 'B', userId: 'other' }])).toEqual([
      { municipalityCode: '01213', mode: 'B' },
    ]);
  });

  it(`${MAX_SNAPSHOT_KEYS} 件ちょうどは受け付け、1件超えると拒否する`, () => {
    expect(validateSrsSnapshotKeys(keys(MAX_SNAPSHOT_KEYS))).toHaveLength(MAX_SNAPSHOT_KEYS);
    expect(() => validateSrsSnapshotKeys(keys(MAX_SNAPSHOT_KEYS + 1))).toThrow('Too many snapshot keys');
  });

  it.each([
    { label: '空配列', input: [] },
    { label: '配列でない', input: { municipalityCode: '01213', mode: 'B' } },
    { label: 'null', input: null },
  ])('$label は拒否する', ({ input }) => {
    expect(() => validateSrsSnapshotKeys(input)).toThrow('Invalid snapshot keys');
  });

  it.each([
    { label: '要素が null', item: null, message: 'Invalid snapshot key' },
    { label: '要素が文字列', item: '01213', message: 'Invalid snapshot key' },
    { label: 'モード E', item: { municipalityCode: '01213', mode: 'E' }, message: 'Invalid mode' },
    { label: 'モード小文字', item: { municipalityCode: '01213', mode: 'a' }, message: 'Invalid mode' },
    { label: 'コード4桁', item: { municipalityCode: '1213', mode: 'B' }, message: 'Invalid municipality code' },
    { label: 'コード6桁', item: { municipalityCode: '012130', mode: 'B' }, message: 'Invalid municipality code' },
    { label: 'コード数値型', item: { municipalityCode: 1213, mode: 'B' }, message: 'Invalid municipality code' },
    { label: 'SQL 風文字列', item: { municipalityCode: "0' OR 1", mode: 'B' }, message: 'Invalid municipality code' },
  ])('$label は拒否する', ({ item, message }) => {
    expect(() => validateSrsSnapshotKeys([item])).toThrow(message);
  });
});
