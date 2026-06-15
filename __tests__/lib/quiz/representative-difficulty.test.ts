import { describe, it, expect } from 'vitest';
import { representativeDifficulty, type Municipality } from '@/lib/quiz/municipality-data';

function muni(code: string, name: string, prefecture: string, difficulty?: Municipality['difficulty']): Municipality {
  return { code, name, prefecture, region: '', difficulty };
}

describe('representativeDifficulty', () => {
  it('単一要素の場合はその難易度を返す', () => {
    const result = representativeDifficulty([muni('1', 'X市', 'A県', 'medium')]);
    expect(result).toBe('medium');
  });

  it('難易度が混在する場合は最も難しいものを返す', () => {
    const result = representativeDifficulty([
      muni('1', 'X市', 'A県', 'easy'),
      muni('2', 'X市', 'B県', 'hard'),
      muni('3', 'X市', 'C県', 'medium'),
    ]);
    expect(result).toBe('hard');
  });

  it('一部が difficulty undefined を含む場合は残りのうち最難を返す', () => {
    const result = representativeDifficulty([
      muni('1', 'X市', 'A県', undefined),
      muni('2', 'X市', 'B県', 'easy'),
      muni('3', 'X市', 'C県', 'medium'),
    ]);
    expect(result).toBe('medium');
  });

  it('全要素が difficulty undefined の場合は undefined を返す', () => {
    const result = representativeDifficulty([
      muni('1', 'X市', 'A県', undefined),
      muni('2', 'X市', 'B県', undefined),
    ]);
    expect(result).toBeUndefined();
  });

  it('空配列の場合は undefined を返す', () => {
    expect(representativeDifficulty([])).toBeUndefined();
  });
});
