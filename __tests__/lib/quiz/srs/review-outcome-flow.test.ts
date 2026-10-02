import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Question, SingleQuestion } from '@/components/quiz/use-quiz-session';
import type { Municipality } from '@/lib/quiz/municipality-data';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import {
  createReviewOutcomeFlow,
  type OutcomeState,
  type SnapshotFetcher,
} from '@/lib/quiz/srs/review-outcome-flow';
import type { SrsSnapshotEntry, SrsSnapshotKey, SrsSnapshotRecord } from '@/lib/quiz/srs/snapshot';

const NOW = new Date('2026-06-01T10:00:00Z');

function muni(code: string, name: string): Municipality {
  return { code, name, prefecture: '北海道', region: '北海道', difficulty: 'easy' };
}

function single(m: Municipality): SingleQuestion {
  return { kind: 'BCD', mode: 'B', municipality: m, choices: [] };
}

function record(over: Partial<SrsSnapshotRecord> = {}): SrsSnapshotRecord {
  return {
    easeFactor: 2.5,
    repetition: 1,
    interval: 1,
    status: 'reviewing',
    dueDate: '2026-06-01T00:00:00.000Z',
    lastReviewedAt: '2026-05-20T01:00:00.000Z',
    ...over,
  };
}

function metaFor(q: SingleQuestion, questionIndex: number, persisted = true): QuestionSaveMeta {
  return { questionIndex, persisted, mode: q.mode, isCorrect: true, codes: [q.municipality.code], srsSkippedCodes: [] };
}

function resultFor(q: SingleQuestion): QuizResultEntry {
  return { name: q.municipality.name, prefecture: q.municipality.prefecture, correct: true };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const q1 = single(muni('01202', '函館市'));
const q2 = single(muni('01203', '小樽市'));
const questions: Question[] = [q1, q2];
const results = [resultFor(q1), resultFor(q2)];
const fullMeta = [metaFor(q1, 0), metaFor(q2, 1)];

/**
 * 回答前は rep1、回答後は「今回保存した」rep2 を返す。
 * 誤答歴ありにしているのは、誤答歴なしの rep2 は早期卒業して graduated になり、reviewing のままにならないため。
 */
function snapshotOf(keys: SrsSnapshotKey[], after: boolean): SrsSnapshotEntry[] {
  return keys.map((k) => ({
    ...k,
    record: after
      ? record({ repetition: 2, interval: 6, dueDate: '2026-06-07T00:00:00.000Z', lastReviewedAt: '2026-06-01T09:59:00.000Z' })
      : record(),
    everWrong: true,
  }));
}

function setup(fetchSnapshot: SnapshotFetcher) {
  const states: OutcomeState[] = [];
  const flow = createReviewOutcomeFlow({ fetchSnapshot, onChange: (s) => states.push(s), now: () => NOW });
  return { flow, states, last: () => states.at(-1)?.status };
}

let errorSpy: MockInstance<typeof console.error>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('createReviewOutcomeFlow — 正常系', () => {
  it('回答前→回答後スナップショットから成果を作り、回答後は保存成功分のキーだけを取得する', async () => {
    let calls = 0;
    const fetchSnapshot = vi.fn<SnapshotFetcher>((keys) => Promise.resolve(snapshotOf(keys, calls++ > 0)));
    const { flow, states } = setup(fetchSnapshot);

    await flow.startBatch(questions);
    await flow.complete(results, [metaFor(q1, 0), metaFor(q2, 1, false)]);

    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
    expect(fetchSnapshot.mock.calls[1]?.[0]).toEqual([{ municipalityCode: '01202', mode: 'B' }]);
    const ready = states.at(-1);
    expect(ready?.status === 'ready' && ready.outcome.summary).toEqual({ graduated: 0, continuing: 1, saveFailed: 1 });
  });
});

describe('createReviewOutcomeFlow — 回答前スナップショットの順序（FR-001）', () => {
  it('startBatch は回答前スナップショットの取得が終わるまで解決しない', async () => {
    const pre = deferred<SrsSnapshotEntry[]>();
    const { flow } = setup(() => pre.promise);

    let started = false;
    const starting = flow.startBatch(questions).then(() => {
      started = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toBe(false);

    pre.resolve(snapshotOf([], false));
    await starting;
    expect(started).toBe(true);
  });
});

describe('createReviewOutcomeFlow — 従来表示へのフォールバック（FR-008）', () => {
  it.each<{ name: string; fetchSnapshot: SnapshotFetcher; meta: readonly QuestionSaveMeta[] | undefined; states: string[]; fetchCalls: number; logged: boolean }>([
    {
      name: '回答前取得が失敗したら回答後取得をせず unavailable',
      fetchSnapshot: () => Promise.reject(new Error('boom')),
      meta: fullMeta,
      states: ['unavailable'],
      fetchCalls: 1,
      logged: true,
    },
    {
      name: '回答後取得が失敗したら loading → unavailable',
      fetchSnapshot: (() => {
        let n = 0;
        return (keys: SrsSnapshotKey[]) => (n++ === 0 ? Promise.resolve(snapshotOf(keys, false)) : Promise.reject(new Error('boom')));
      })(),
      meta: fullMeta,
      states: ['loading', 'unavailable'],
      fetchCalls: 2,
      logged: true,
    },
    {
      name: '保存メタが欠けていたら回答後取得をせず unavailable',
      fetchSnapshot: (keys) => Promise.resolve(snapshotOf(keys, false)),
      meta: [fullMeta[0]].filter((m): m is QuestionSaveMeta => !!m),
      states: ['unavailable'],
      fetchCalls: 1,
      logged: false,
    },
    {
      name: '保存メタが渡されなかったら unavailable',
      fetchSnapshot: (keys) => Promise.resolve(snapshotOf(keys, false)),
      meta: undefined,
      states: ['unavailable'],
      fetchCalls: 1,
      logged: false,
    },
  ])('$name', async ({ fetchSnapshot, meta, states: expected, fetchCalls, logged }) => {
    const spy = vi.fn(fetchSnapshot);
    const { flow, states } = setup(spy);
    await flow.startBatch(questions);
    await flow.complete(results, meta);
    expect(states.map((s) => s.status)).toEqual(expected);
    expect(spy).toHaveBeenCalledTimes(fetchCalls);
    expect(errorSpy).toHaveBeenCalledTimes(logged ? 1 : 0);
    if (logged) {
      expect(errorSpy).toHaveBeenCalledWith(
        '[review] failed to load srs snapshot',
        expect.objectContaining({ count: 2 }),
      );
    }
  });

  it('キーが100件を超えるバッチは取得せずに unavailable', async () => {
    const many = Array.from({ length: 101 }, (_, i) => single(muni(String(10000 + i), `市${i}`)));
    const spy = vi.fn<SnapshotFetcher>((keys) => Promise.resolve(snapshotOf(keys, false)));
    const { flow, last } = setup(spy);

    await flow.startBatch(many);
    await flow.complete(many.map(resultFor), many.map((q, i) => metaFor(q, i)));

    expect(spy).not.toHaveBeenCalled();
    expect(last()).toBe('unavailable');
  });

  it('startBatch 前に complete されたら unavailable', async () => {
    const { flow, last } = setup(() => Promise.resolve([]));
    await flow.complete(results, fullMeta);
    expect(last()).toBe('unavailable');
  });
});

describe('createReviewOutcomeFlow — 古い応答の破棄（FR-009）', () => {
  it('startBatch が重なり古い回答前取得が後着しても、古いバッチは採用しない', async () => {
    const preA = deferred<SrsSnapshotEntry[]>();
    const preB = deferred<SrsSnapshotEntry[]>();
    const pending = [preA, preB];
    let n = 0;
    const { flow, states } = setup((keys) => {
      const d = pending[n++];
      return d ? d.promise : Promise.resolve(snapshotOf(keys, true));
    });

    const batchA = [q1];
    const batchB = [q2];
    const startA = flow.startBatch(batchA);
    const startB = flow.startBatch(batchB);
    preB.resolve(snapshotOf([{ municipalityCode: '01203', mode: 'B' }], false));
    preA.resolve(snapshotOf([{ municipalityCode: '01202', mode: 'B' }], false));

    expect(await startB).toBe(true);
    expect(await startA).toBe(false);

    await flow.complete([resultFor(q2)], [metaFor(q2, 0)]);
    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
  });

  it('取得中に reset されたら startBatch は false を返す', async () => {
    const pre = deferred<SrsSnapshotEntry[]>();
    const { flow, last } = setup(() => pre.promise);
    const starting = flow.startBatch(questions);
    flow.reset();
    pre.resolve([]);
    expect(await starting).toBe(false);
    await flow.complete(results, fullMeta);
    expect(last()).toBe('unavailable');
  });

  it('「続けて復習する」で reset した後に前バッチの回答後スナップショットが返っても反映しない', async () => {
    const post = deferred<SrsSnapshotEntry[]>();
    let n = 0;
    const { flow, states } = setup((keys) => (n++ === 1 ? post.promise : Promise.resolve(snapshotOf(keys, false))));

    await flow.startBatch(questions);
    const completing = flow.complete(results, fullMeta);
    flow.reset();
    await flow.startBatch(questions);

    post.resolve(snapshotOf([{ municipalityCode: '01202', mode: 'B' }, { municipalityCode: '01203', mode: 'B' }], true));
    await completing;

    expect(states.map((s) => s.status)).toEqual(['loading']);
  });
});
