import type { GameMode } from '@/lib/quiz/municipality-data';
import type { SrsStatus } from './types';

export const MAX_SNAPSHOT_KEYS = 100;

const VALID_MODES: readonly GameMode[] = ['A', 'B', 'C', 'D'];
const MUNICIPALITY_CODE_PATTERN = /^\d{5}$/;

export interface SrsSnapshotKey {
  municipalityCode: string;
  mode: GameMode;
}

export interface SrsSnapshotRecord {
  easeFactor: number;
  repetition: number;
  interval: number;
  status: SrsStatus;
  dueDate: string;
  lastReviewedAt: string | null;
}

export interface SrsSnapshotEntry extends SrsSnapshotKey {
  record: SrsSnapshotRecord | null;
  everWrong: boolean;
}

export function srsKeyId(key: SrsSnapshotKey): string {
  return `${key.municipalityCode}::${key.mode}`;
}

/**
 * Server Action に届いた任意の入力を検証し、重複を畳んだキー配列を返す。
 * 範囲外の入力は throw する（呼び出し側はクライアント由来の値を信用しない）。
 */
export function validateSrsSnapshotKeys(input: unknown): SrsSnapshotKey[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Invalid snapshot keys');
  if (input.length > MAX_SNAPSHOT_KEYS) throw new Error('Too many snapshot keys');

  const seen = new Set<string>();
  const keys: SrsSnapshotKey[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) throw new Error('Invalid snapshot key');
    const { municipalityCode, mode } = raw as Record<string, unknown>;
    if (typeof mode !== 'string' || !VALID_MODES.includes(mode as GameMode)) {
      throw new Error('Invalid mode');
    }
    if (typeof municipalityCode !== 'string' || !MUNICIPALITY_CODE_PATTERN.test(municipalityCode)) {
      throw new Error('Invalid municipality code');
    }
    const key: SrsSnapshotKey = { municipalityCode, mode: mode as GameMode };
    const id = srsKeyId(key);
    if (seen.has(id)) continue;
    seen.add(id);
    keys.push(key);
  }
  return keys;
}
