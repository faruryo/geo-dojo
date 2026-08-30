import type { GameMode, Municipality } from './municipality-data';
import { toQuestionResult } from './quiz-results';

export interface QuizSessionEntry {
  municipality: Municipality;
  isCorrect: boolean;
  mode: GameMode;
  answerTimeMs?: number;
}

export interface QuizResultEntry {
  name: string;
  prefecture: string;
  correct: boolean;
  kana?: string;
}

export type SaveResultFn = (input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  answerTimeMs?: number;
}) => Promise<{ quizPersisted: boolean }>;

export interface QuizAdvanceLogger {
  error: (message: string, context?: unknown) => void;
}

/**
 * 1問解答時の結果集計（1問1件正規化）と DB 保存（全インスタンス保存 + 失敗ログ）を
 * 担う純粋進行ハンドラ。
 *
 * 不変条件:
 * 1. Mode A など複数インスタンスが存在しても、表示用結果は toQuestionResult で必ず 1問1件に集約する。
 * 2. DB 保存は Promise.allSettled で全件実行し、失敗時は UX を止めずに明示ログを出力する。
 */
export async function executeQuizAdvance(
  entries: readonly QuizSessionEntry[],
  currentResults: readonly QuizResultEntry[],
  saveFn: SaveResultFn,
  logger: QuizAdvanceLogger = console,
): Promise<{ results: QuizResultEntry[]; persisted: boolean }> {
  const results = [...currentResults, toQuestionResult(entries as QuizSessionEntry[])];

  let persisted = true;
  const savePromises = entries.map(async (entry) => {
    try {
      const { quizPersisted } = await saveFn({
        municipalityCode: entry.municipality.code,
        municipalityName: entry.municipality.name,
        prefecture: entry.municipality.prefecture,
        mode: entry.mode,
        isCorrect: entry.isCorrect,
        answerTimeMs: entry.answerTimeMs,
      });
      if (!quizPersisted) persisted = false;
    } catch (reason: unknown) {
      persisted = false;
      logger.error('[quiz-runner] failed to save result', {
        code: entry.municipality.code,
        mode: entry.mode,
        reason,
      });
    }
  });

  await Promise.allSettled(savePromises);

  return { results, persisted };
}

/**
 * Mode D タイムアウト時の解答エントリを生成する純粋ヘルパー。
 */
export function createTimeoutEntry(
  municipality: Municipality,
  timeLimitSec: number = 30,
): QuizSessionEntry {
  return {
    municipality,
    isCorrect: false,
    mode: 'D',
    answerTimeMs: timeLimitSec * 1000,
  };
}
