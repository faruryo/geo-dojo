import type { Question } from '@/components/quiz/use-quiz-session';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import {
  buildReviewOutcome,
  collectSrsKeys,
  isSaveMetaConsistent,
  persistedSrsKeys,
  type ReviewOutcome,
} from '@/lib/quiz/srs/outcome';
import { MAX_SNAPSHOT_KEYS, type SrsSnapshotEntry, type SrsSnapshotKey } from '@/lib/quiz/srs/snapshot';

export type SnapshotFetcher = (keys: SrsSnapshotKey[]) => Promise<SrsSnapshotEntry[]>;

export type OutcomeState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; outcome: ReviewOutcome };

interface ReviewOutcomeFlowDeps {
  fetchSnapshot: SnapshotFetcher;
  onChange: (state: OutcomeState) => void;
  now?: () => Date;
}

interface ActiveBatch {
  id: number;
  questions: readonly Question[];
  /** 出題開始前の SRS 状態。取得できなければ null で、成果表示は行わない。 */
  pre: SrsSnapshotEntry[] | null;
}

/**
 * 復習バッチ1回分の「回答前スナップショット → 完了時の整合ガード → 回答後スナップショット → 成果」を進める。
 * どの段階で失敗しても onChange には unavailable を渡し、画面は従来表示に戻る。
 */
export function createReviewOutcomeFlow({ fetchSnapshot, onChange, now = () => new Date() }: ReviewOutcomeFlowDeps) {
  let seq = 0;
  let active: ActiveBatch | null = null;

  async function load(keys: SrsSnapshotKey[]): Promise<SrsSnapshotEntry[] | null> {
    if (keys.length === 0) return [];
    if (keys.length > MAX_SNAPSHOT_KEYS) return null;
    try {
      return await fetchSnapshot(keys);
    } catch (reason: unknown) {
      console.error('[review] failed to load srs snapshot', { count: keys.length, reason });
      return null;
    }
  }

  return {
    /**
     * 1問目の保存より先に解決させること。遅れると回答後の値を回答前として読んでしまう。
     * 取得中に別の startBatch / reset が走っていたら false を返し、呼び出し側はその問題で出題を始めない。
     */
    async startBatch(questions: readonly Question[]): Promise<boolean> {
      seq += 1;
      const id = seq;
      const pre = await load(collectSrsKeys(questions));
      if (id !== seq) return false;
      active = { id, questions, pre };
      return true;
    },

    reset(): void {
      seq += 1;
      active = null;
    },

    async complete(results: QuizResultEntry[], saveMeta: readonly QuestionSaveMeta[] | undefined): Promise<void> {
      const batch = active;
      if (!batch?.pre || !isSaveMetaConsistent(batch.questions, saveMeta, results.length)) {
        onChange({ status: 'unavailable' });
        return;
      }
      onChange({ status: 'loading' });
      const post = await load(persistedSrsKeys(batch.questions, saveMeta));
      if (active?.id !== batch.id) return;
      const outcome = post
        ? buildReviewOutcome({ questions: batch.questions, results, meta: saveMeta, pre: batch.pre, post, now: now() })
        : null;
      onChange(outcome ? { status: 'ready', outcome } : { status: 'unavailable' });
    },
  };
}

export type ReviewOutcomeFlow = ReturnType<typeof createReviewOutcomeFlow>;
