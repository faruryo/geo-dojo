export type ModeKey = 'A' | 'B' | 'C' | 'D';

export const LAST_SELECTED_MODE_KEY = 'geo-dojo:last-selected-mode';

const VALID_MODES: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D']);

export function parseGameMode(mode: unknown): ModeKey | null {
  if (typeof mode !== 'string') return null;
  const upper = mode.toUpperCase();
  return VALID_MODES.has(upper) ? (upper as ModeKey) : null;
}

/**
 * モード選択画面の初期選択モードを決定する（純粋関数）。
 * 優先順位: URLパラメータ > 保存済みモード > デフォルト('B')
 */
export function resolveInitialSelectedMode(
  modeParam: string | null | undefined,
  savedMode: string | null | undefined,
  fallbackMode: ModeKey = 'B',
): ModeKey {
  const paramMode = parseGameMode(modeParam);
  if (paramMode) return paramMode;

  const saved = parseGameMode(savedMode);
  if (saved) return saved;

  return fallbackMode;
}
