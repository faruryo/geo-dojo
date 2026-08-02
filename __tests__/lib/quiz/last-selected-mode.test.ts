import { describe, expect, it } from 'vitest';
import {
  parseGameMode,
  resolveInitialSelectedMode,
  LAST_SELECTED_MODE_KEY,
} from '@/lib/quiz/last-selected-mode';

describe('parseGameMode', () => {
  it('有効なモード文字列を大文字化して返す', () => {
    expect(parseGameMode('a')).toBe('A');
    expect(parseGameMode('B')).toBe('B');
    expect(parseGameMode('c')).toBe('C');
    expect(parseGameMode('D')).toBe('D');
  });

  it('無効な入力には null を返す', () => {
    expect(parseGameMode('E')).toBeNull();
    expect(parseGameMode('')).toBeNull();
    expect(parseGameMode(123)).toBeNull();
    expect(parseGameMode(null)).toBeNull();
    expect(parseGameMode(undefined)).toBeNull();
  });
});

describe('resolveInitialSelectedMode', () => {
  it('modeParam が最優先で選択される', () => {
    expect(resolveInitialSelectedMode('a', 'C')).toBe('A');
    expect(resolveInitialSelectedMode('D', 'B')).toBe('D');
  });

  it('modeParam がなく savedMode がある場合は savedMode が選択される', () => {
    expect(resolveInitialSelectedMode(null, 'c')).toBe('C');
    expect(resolveInitialSelectedMode(undefined, 'A')).toBe('A');
  });

  it('どちらも無効・存在しない場合はデフォルト(B)が返る', () => {
    expect(resolveInitialSelectedMode(null, null)).toBe('B');
    expect(resolveInitialSelectedMode('invalid', 'invalid')).toBe('B');
    expect(resolveInitialSelectedMode(undefined, undefined, 'A')).toBe('A');
  });
});

describe('LAST_SELECTED_MODE_KEY', () => {
  it('正しい localStorage キー名が定義されている', () => {
    expect(LAST_SELECTED_MODE_KEY).toBe('geo-dojo:last-selected-mode');
  });
});
