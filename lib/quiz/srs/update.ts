import { applySm2 } from './sm2';
import { alreadyAdvancedToday } from './scheduler';
import type { SrsStatus } from './types';

/** DB の srs_records 行のうち SM-2 判定に必要な部分 */
export interface ExistingSrs {
  easeFactor: number;
  repetition: number;
  interval: number;
  status: SrsStatus;
  lastReviewedAt: Date | null;
}

export type SrsUpdateAction =
  | { kind: 'skip' } // 同日ガード等で更新しない
  | {
      kind: 'upsert';
      easeFactor: number;
      repetition: number;
      interval: number;
      status: SrsStatus;
      dueDate: Date;
      lastReviewedAt: Date;
    };

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STATE = { easeFactor: 2.5, repetition: 0, interval: 0, status: 'reviewing' as SrsStatus };

/**
 * 1回の回答に対する srs_records の更新内容を決める純粋関数（副作用なし）。
 *
 * - 不正解: 常にリセット/復帰（同日ガードの対象外）。graduated でも reviewing に戻す。
 *           everWrong の値には影響されない。
 * - 正解  : JST 同日に既に前進済みなら skip（1日1回まで前進 / FR-005a）。
 *           未前進なら SM-2 で前進し、閾値到達で graduated。
 *           さらに `everWrong=false`（誤答履歴なし）かつ新 repetition >= 2 なら、
 *           SM-2 の通常卒業条件（interval>=30 && rep>=4）を待たず早期卒業させる
 *           （easeFactor/interval/dueDate は SM-2 の計算値のまま、status のみ上書き）。
 * - 新規(existing=null): 既定状態から開始。
 */
export function computeSrsUpdate(
  existing: ExistingSrs | null,
  isCorrect: boolean,
  now: Date,
  everWrong: boolean,
): SrsUpdateAction {
  // 正解の同日ガード（既存レコードのみ）
  if (isCorrect && existing && alreadyAdvancedToday(existing.lastReviewedAt, now)) {
    return { kind: 'skip' };
  }

  const state = existing
    ? {
        easeFactor: existing.easeFactor,
        repetition: existing.repetition,
        interval: existing.interval,
        status: existing.status,
      }
    : DEFAULT_STATE;

  const quality = isCorrect ? (4 as const) : (2 as const);
  const result = applySm2(state, quality);
  const dueDate = new Date(now.getTime() + result.dueInDays * DAY_MS);
  const status: SrsStatus =
    isCorrect && !everWrong && result.repetition >= 2 ? 'graduated' : result.status;

  return {
    kind: 'upsert',
    easeFactor: result.easeFactor,
    repetition: result.repetition,
    interval: result.interval,
    status,
    dueDate,
    lastReviewedAt: now,
  };
}
