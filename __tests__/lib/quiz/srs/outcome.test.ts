import { describe, it, expect } from 'vitest';
import type { ModeAQuestion, Question, SingleQuestion } from '@/components/quiz/use-quiz-session';
import type { Municipality } from '@/lib/quiz/municipality-data';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import {
  buildReviewOutcome,
  collectSrsKeys,
  formatOutcomeLabel,
  formatRemainingSteps,
  isSaveMetaConsistent,
  persistedSrsKeys,
  resolveOutcomeLabel,
  type OutcomeLabel,
} from '@/lib/quiz/srs/outcome';
import type { SrsSnapshotEntry, SrsSnapshotRecord } from '@/lib/quiz/srs/snapshot';

const NOW = new Date('2026-06-01T10:00:00Z'); // JST 2026-06-01 19:00
const EARLIER = '2026-05-20T01:00:00.000Z';
const SAVED_AT = '2026-06-01T09:59:00.000Z';

function muni(code: string, name: string, prefecture: string): Municipality {
  return { code, name, prefecture, region: '北海道', difficulty: 'easy' };
}

function single(mode: 'B' | 'C' | 'D', m: Municipality): SingleQuestion {
  return { kind: 'BCD', mode, municipality: m, choices: [] };
}

function modeA(name: string, instances: Municipality[]): ModeAQuestion {
  return { kind: 'A', name, instances, correctPrefectures: new Set(instances.map((m) => m.prefecture)) };
}

function record(over: Partial<SrsSnapshotRecord> = {}): SrsSnapshotRecord {
  return {
    easeFactor: 2.5,
    repetition: 1,
    interval: 1,
    status: 'reviewing',
    dueDate: '2026-06-01T00:00:00.000Z',
    lastReviewedAt: EARLIER,
    ...over,
  };
}

function entry(
  municipalityCode: string,
  mode: 'A' | 'B' | 'C' | 'D',
  rec: SrsSnapshotRecord | null,
  everWrong = false,
): SrsSnapshotEntry {
  return { municipalityCode, mode, record: rec, everWrong };
}

function meta(questionIndex: number, q: Question, isCorrect: boolean, persisted = true): QuestionSaveMeta {
  const codes =
    q.kind === 'A'
      ? [...new Map(q.instances.map((m) => [m.prefecture, m.code])).values()]
      : [q.municipality.code];
  return { questionIndex, persisted, mode: q.kind === 'A' ? 'A' : q.mode, isCorrect, codes };
}

function result(name: string, correct: boolean): QuizResultEntry {
  return { name, prefecture: '', correct };
}

describe('resolveOutcomeLabel — 判定表（data-model.md）', () => {
  const pre = (rec: SrsSnapshotRecord | null) => entry('01101', 'B', rec);
  const post = (rec: SrsSnapshotRecord) => entry('01101', 'B', rec);

  it.each<{ label: string; input: Parameters<typeof resolveOutcomeLabel>[0]; expected: OutcomeLabel }>([
    {
      label: '1. 保存失敗は post が無くても saveFailed',
      input: { persisted: false, isCorrect: true, pre: pre(record()), post: undefined, now: NOW },
      expected: { kind: 'saveFailed' },
    },
    {
      label: '2. 正解でも last_reviewed_at が変わらなければ同日ガード',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record({ lastReviewedAt: SAVED_AT, dueDate: '2026-06-02T09:00:00.000Z' })),
        post: post(record({ lastReviewedAt: SAVED_AT, dueDate: '2026-06-02T09:00:00.000Z' })),
        now: NOW,
      },
      expected: { kind: 'sameDay' },
    },
    {
      label: '3. 卒業済みからの誤答は relapsed',
      input: {
        persisted: true,
        isCorrect: false,
        pre: pre(record({ status: 'graduated', repetition: 4, interval: 38 })),
        post: post(record({ repetition: 0, lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'relapsed' },
    },
    {
      label: '4. reviewing からの誤答は retryTomorrow',
      input: {
        persisted: true,
        isCorrect: false,
        pre: pre(record()),
        post: post(record({ repetition: 0, lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'retryTomorrow' },
    },
    {
      label: '4. 回答前レコードなしの誤答も retryTomorrow',
      input: {
        persisted: true,
        isCorrect: false,
        pre: pre(null),
        post: post(record({ repetition: 0, lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'retryTomorrow' },
    },
    {
      label: '5. 卒業済みで正解し卒業のまま → kept',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record({ status: 'graduated' })),
        post: post(record({ status: 'graduated', lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'kept' },
    },
    {
      label: '6. reviewing から卒業 → graduated',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record()),
        post: post(record({ status: 'graduated', repetition: 2, lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'graduated' },
    },
    {
      label: '6. 回答前レコードなしから卒業 → graduated（同日ガード扱いにしない）',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(null),
        post: post(record({ status: 'graduated', lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'graduated' },
    },
    {
      label: '7. reviewing のまま前進 → scheduled（13日後）',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record()),
        post: post(record({ dueDate: '2026-06-14T09:59:00.000Z', lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'scheduled', daysUntil: 13 },
    },
    {
      label: '7. JST 23:59 の期日は同じ暦日 → 0',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record()),
        post: post(record({ dueDate: '2026-06-01T14:59:00.000Z', lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'scheduled', daysUntil: 0 },
    },
    {
      label: '7. 5時間後でも JST 翌日 0:00 なら 1（ミリ秒差の切り上げにしない）',
      input: {
        persisted: true,
        isCorrect: true,
        pre: pre(record()),
        post: post(record({ dueDate: '2026-06-01T15:00:00.000Z', lastReviewedAt: SAVED_AT })),
        now: NOW,
      },
      expected: { kind: 'scheduled', daysUntil: 1 },
    },
  ])('$label', ({ input, expected }) => {
    expect(resolveOutcomeLabel(input)).toEqual(expected);
  });

  it('保存成功なのに回答後レコードが無ければ null（不整合）', () => {
    expect(
      resolveOutcomeLabel({ persisted: true, isCorrect: true, pre: pre(record()), post: undefined, now: NOW }),
    ).toBeNull();
    expect(
      resolveOutcomeLabel({
        persisted: true,
        isCorrect: true,
        pre: pre(record()),
        post: entry('01101', 'B', null),
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('formatOutcomeLabel / formatRemainingSteps', () => {
  it.each<{ label: OutcomeLabel; text: string }>([
    { label: { kind: 'saveFailed' }, text: '⚠️ 保存失敗' },
    { label: { kind: 'sameDay' }, text: '⏸️ 同日回答済み' },
    { label: { kind: 'relapsed' }, text: '⚠️ 復習に戻りました（明日もう一度）' },
    { label: { kind: 'retryTomorrow' }, text: '🔄 明日もう一度' },
    { label: { kind: 'kept' }, text: '🎓 定着維持' },
    { label: { kind: 'graduated' }, text: '🎉 卒業（定着達成）' },
    { label: { kind: 'scheduled', daysUntil: -1 }, text: '📅 次回 今日' },
    { label: { kind: 'scheduled', daysUntil: 0 }, text: '📅 次回 今日' },
    { label: { kind: 'scheduled', daysUntil: 1 }, text: '📅 次回 明日' },
    { label: { kind: 'scheduled', daysUntil: 2 }, text: '📅 次回 2日後' },
  ])('$text', ({ label, text }) => {
    expect(formatOutcomeLabel(label)).toBe(text);
  });

  it('残り回数の文言', () => {
    expect(formatRemainingSteps(3)).toBe('通常の速さならあと3回で卒業');
    expect(formatRemainingSteps(null)).toBe('通常の速さなら20回以上');
  });
});

// ─── バッチ全体 ───────────────────────────────────────────────

const tateyama = muni('12205', '館山市', '千葉県');
const choshi = muni('12202', '銚子市', '千葉県');
const dateHokkaido = muni('01233', '伊達市', '北海道');
const dateFukushima = muni('07213', '伊達市', '福島県');
const kyotoWard = muni('26101', '北区', '京都府');

const qB = single('B', tateyama);
const qC = single('C', choshi);
const qA = modeA('伊達市', [dateHokkaido, dateFukushima]);
const qD = single('D', kyotoWard);
const questions: Question[] = [qB, qC, qA, qD];

const results = [
  result('館山市', true),
  result('銚子市', false),
  result('伊達市', true),
  result('北区', true),
];

const preSnapshot: SrsSnapshotEntry[] = [
  entry('12205', 'B', record({ repetition: 1 }), false),
  entry('12202', 'C', record({ repetition: 2, interval: 6 }), false),
  entry('01233', 'A', record({ repetition: 1 }), false),
  entry('07213', 'A', record({ repetition: 1, easeFactor: 2.18 }), true),
  entry('26101', 'D', record(), false),
];

const postSnapshot: SrsSnapshotEntry[] = [
  entry('12205', 'B', record({ status: 'graduated', repetition: 2, interval: 6, lastReviewedAt: SAVED_AT }), false),
  entry('12202', 'C', record({ repetition: 0, interval: 1, easeFactor: 2.18, dueDate: '2026-06-02T09:59:00.000Z', lastReviewedAt: SAVED_AT }), true),
  entry('01233', 'A', record({ status: 'graduated', repetition: 2, interval: 6, lastReviewedAt: SAVED_AT }), false),
  entry('07213', 'A', record({ repetition: 2, interval: 6, easeFactor: 2.18, dueDate: '2026-06-07T09:59:00.000Z', lastReviewedAt: SAVED_AT }), true),
];

const batchMeta: QuestionSaveMeta[] = [
  meta(0, qB, true),
  meta(1, qC, false),
  meta(2, qA, true),
  meta(3, qD, true, false),
];

function build(over: Partial<Parameters<typeof buildReviewOutcome>[0]> = {}) {
  return buildReviewOutcome({
    questions,
    results,
    meta: batchMeta,
    pre: preSnapshot,
    post: postSnapshot,
    now: NOW,
    ...over,
  });
}

function buildOrThrow(over: Partial<Parameters<typeof buildReviewOutcome>[0]> = {}) {
  const outcome = build(over);
  if (!outcome) throw new Error('buildReviewOutcome returned null');
  return outcome;
}

describe('buildReviewOutcome — サマリ（1問1件）', () => {
  it('定着・復習継続・保存失敗に分類し、合計が回答した問題数と一致する', () => {
    const outcome = buildOrThrow();
    expect(outcome.summary).toEqual({ graduated: 1, continuing: 2, saveFailed: 1 });
    const { graduated, continuing, saveFailed } = outcome.summary;
    expect(graduated + continuing + saveFailed).toBe(results.length);
  });

  it('Mode A で片方の県だけ卒業した問題は復習継続で、県ごとに別ラベルの行を持つ', () => {
    const date = buildOrThrow().questions[2];
    expect(date.category).toBe('continuing');
    expect(date.rows.map((r) => [r.prefecture, r.label.kind])).toEqual([
      ['北海道', 'graduated'],
      ['福島県', 'scheduled'],
    ]);
    expect(date.rows[0].remainingSteps).toBeUndefined();
    // 回答後 rep2 int6 EF2.18 誤答歴あり: 13 → 28 → 61 で3回
    expect(date.rows[1].remainingSteps).toBe(3);
  });

  it('Mode A で全県が卒業したときだけ定着に数える', () => {
    const allGraduated = postSnapshot.map((e) =>
      e.municipalityCode === '07213'
        ? entry('07213', 'A', record({ status: 'graduated', lastReviewedAt: SAVED_AT }), true)
        : e,
    );
    const outcome = build({ post: allGraduated });
    expect(outcome?.questions[2].category).toBe('graduated');
    expect(outcome?.summary).toEqual({ graduated: 2, continuing: 1, saveFailed: 1 });
  });

  it('保存失敗の問題は回答後スナップショットが無くても保存失敗として隔離される', () => {
    const failed = buildOrThrow().questions[3];
    expect(failed.category).toBe('saveFailed');
    expect(failed.rows).toEqual([
      { code: '26101', prefecture: '京都府', label: { kind: 'saveFailed' }, graduated: false },
    ]);
  });

  it('誤答の残り回数は「回答前の誤答歴 OR 今回誤答」で算出する（誤答歴なしでも早期卒業を前提にしない）', () => {
    const wrong = buildOrThrow().questions[1];
    expect(wrong.rows[0].label).toEqual({ kind: 'retryTomorrow' });
    // rep0 int1 EF2.18 を誤答歴ありで回すと5回。誤答歴なし扱いだと2回になってしまう
    expect(wrong.rows[0].remainingSteps).toBe(5);
  });

  it('表示名・よみがなは 1問1件に正規化済みの results から取る', () => {
    const outcome = build({ results: results.map((r, i) => (i === 3 ? { ...r, name: '京都市北区', kana: 'きょうとしきたく' } : r)) });
    expect(outcome?.questions[3]).toMatchObject({ name: '京都市北区', kana: 'きょうとしきたく' });
  });

  it('政令市（同県の複数区コード）を含む Mode A 問題は県別代表1行に畳む', () => {
    const sapporo = modeA('札幌市', [muni('01101', '札幌市', '北海道'), muni('01102', '札幌市', '北海道')]);
    const outcome = buildReviewOutcome({
      questions: [sapporo],
      results: [result('札幌市', true)],
      meta: [{ questionIndex: 0, persisted: true, mode: 'A', isCorrect: true, codes: ['01101'] }],
      pre: [entry('01101', 'A', record())],
      post: [entry('01101', 'A', record({ dueDate: '2026-06-02T09:59:00.000Z', lastReviewedAt: SAVED_AT }))],
      now: NOW,
    });
    expect(outcome?.questions[0].rows.map((r) => r.code)).toEqual(['01101']);
  });
});

describe('buildReviewOutcome / isSaveMetaConsistent — 整合ガード', () => {
  it.each<{ label: string; meta: QuestionSaveMeta[] | undefined }>([
    { label: 'meta 未指定', meta: undefined },
    { label: '件数が結果数より少ない', meta: batchMeta.slice(0, 3) },
    { label: '問題番号の重複', meta: [batchMeta[0], { ...batchMeta[1], questionIndex: 0 }, batchMeta[2], batchMeta[3]] },
    { label: '問題番号が範囲外', meta: [...batchMeta.slice(0, 3), { ...batchMeta[3], questionIndex: 4 }] },
    { label: '問題番号が負数', meta: [{ ...batchMeta[0], questionIndex: -1 }, ...batchMeta.slice(1)] },
    { label: 'コード集合が出題と違う（別の区コード）', meta: [...batchMeta.slice(0, 3), { ...batchMeta[3], codes: ['26102'] }] },
    { label: 'Mode A のコード順が保存時と違う', meta: [batchMeta[0], batchMeta[1], { ...batchMeta[2], codes: ['07213', '01233'] }, batchMeta[3]] },
    { label: 'Mode A の県が欠けている', meta: [batchMeta[0], batchMeta[1], { ...batchMeta[2], codes: ['01233'] }, batchMeta[3]] },
    { label: 'モードが出題と違う', meta: [{ ...batchMeta[0], mode: 'C' }, ...batchMeta.slice(1)] },
  ])('$label なら null（従来表示へフォールバック）', ({ meta: m }) => {
    expect(isSaveMetaConsistent(questions, m, results.length)).toBe(false);
    expect(build({ meta: m })).toBeNull();
  });

  it('整合していれば true', () => {
    expect(isSaveMetaConsistent(questions, batchMeta, results.length)).toBe(true);
  });

  it('回答前スナップショットに欠けた行があれば null', () => {
    expect(build({ pre: preSnapshot.filter((e) => e.municipalityCode !== '07213') })).toBeNull();
  });

  it('保存成功した行の回答後スナップショットが無ければ null', () => {
    expect(build({ post: postSnapshot.filter((e) => e.municipalityCode !== '12205') })).toBeNull();
  });
});

describe('collectSrsKeys / persistedSrsKeys', () => {
  it('出題から保存単位のキーを導く（Mode A は県別代表）', () => {
    expect(collectSrsKeys(questions)).toEqual([
      { municipalityCode: '12205', mode: 'B' },
      { municipalityCode: '12202', mode: 'C' },
      { municipalityCode: '01233', mode: 'A' },
      { municipalityCode: '07213', mode: 'A' },
      { municipalityCode: '26101', mode: 'D' },
    ]);
  });

  it('回答後に引くキーは保存成功した問題だけ', () => {
    expect(persistedSrsKeys(questions, batchMeta).map((k) => k.municipalityCode)).toEqual([
      '12205',
      '12202',
      '01233',
      '07213',
    ]);
  });
});
