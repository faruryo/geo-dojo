import type { Question } from '@/components/quiz/use-quiz-session';
import { dedupeInstancesByPrefecture, type GameMode } from '@/lib/quiz/municipality-data';
import type { QuestionSaveMeta, QuizResultEntry } from '@/lib/quiz/quiz-session-core';
import { diffJSTCalendarDays } from '@/lib/utils/date-jst';
import { MAX_SIMULATION_STEPS, simulateStepsToGraduation } from './simulation';
import { srsKeyId, type SrsSnapshotEntry, type SrsSnapshotKey } from './snapshot';

export interface SaveTarget extends SrsSnapshotKey {
  prefecture: string;
}

/**
 * 1問の回答で保存されるコード×モード。Mode A は保存時（useModeAAction）と同じく
 * dedupeInstancesByPrefecture で県別代表コードに畳む（政令市の区を行に展開しない）。
 */
export function questionSaveTargets(question: Question): SaveTarget[] {
  if (question.kind === 'A') {
    return dedupeInstancesByPrefecture(question.instances).map((m) => ({
      municipalityCode: m.code,
      mode: 'A' as const,
      prefecture: m.prefecture,
    }));
  }
  return [
    {
      municipalityCode: question.municipality.code,
      mode: question.mode,
      prefecture: question.municipality.prefecture,
    },
  ];
}

export function collectSrsKeys(questions: readonly Question[]): SrsSnapshotKey[] {
  const seen = new Set<string>();
  const keys: SrsSnapshotKey[] = [];
  for (const question of questions) {
    for (const { municipalityCode, mode } of questionSaveTargets(question)) {
      const key = { municipalityCode, mode };
      const id = srsKeyId(key);
      if (seen.has(id)) continue;
      seen.add(id);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * 保存メタが出題・結果と1対1で対応しているか。1つでも崩れていれば成果表示は行わない
 * （ずれた対応で「卒業」を出すより、従来表示に倒すほうが安全）。
 */
export function isSaveMetaConsistent(
  questions: readonly Question[],
  meta: readonly QuestionSaveMeta[] | undefined,
  resultCount: number,
): meta is readonly QuestionSaveMeta[] {
  if (!meta || meta.length !== resultCount || resultCount > questions.length) return false;
  const seenIndex = new Set<number>();
  for (const m of meta) {
    if (!Number.isInteger(m.questionIndex) || m.questionIndex < 0 || m.questionIndex >= resultCount) {
      return false;
    }
    if (seenIndex.has(m.questionIndex)) return false;
    seenIndex.add(m.questionIndex);

    const targets = questionSaveTargets(questions[m.questionIndex]);
    if (!targets.every((t) => t.mode === m.mode)) return false;
    if (targets.map((t) => t.municipalityCode).join(',') !== m.codes.join(',')) return false;
    if (!m.srsSkippedCodes.every((code) => m.codes.includes(code))) return false;
  }
  return true;
}

export function persistedSrsKeys(
  questions: readonly Question[],
  meta: readonly QuestionSaveMeta[],
): SrsSnapshotKey[] {
  return collectSrsKeys(meta.filter((m) => m.persisted).map((m) => questions[m.questionIndex]));
}

export type OutcomeLabel =
  | { kind: 'saveFailed' }
  | { kind: 'sameDay' }
  | { kind: 'relapsed' }
  | { kind: 'retryTomorrow' }
  | { kind: 'kept' }
  | { kind: 'graduated' }
  | { kind: 'scheduled'; daysUntil: number };

interface LabelInput {
  persisted: boolean;
  isCorrect: boolean;
  /** 保存時に同日ガードで更新しなかったか。回答前の取得後に別タブが前進させた場合も true になる。 */
  srsSkipped: boolean;
  pre: SrsSnapshotEntry;
  post: SrsSnapshotEntry | undefined;
  now: Date;
}

/** data-model.md の判定表どおり、上から最初に当てはまったラベルを1つ返す。 */
export function resolveOutcomeLabel({ persisted, isCorrect, srsSkipped, pre, post, now }: LabelInput): OutcomeLabel | null {
  if (!persisted) return { kind: 'saveFailed' };
  const after = post?.record;
  if (!after) return null;
  const before = pre.record;

  if (isCorrect && (srsSkipped || (before && after.lastReviewedAt === before.lastReviewedAt))) {
    return { kind: 'sameDay' };
  }
  if (!isCorrect) return before?.status === 'graduated' ? { kind: 'relapsed' } : { kind: 'retryTomorrow' };
  if (after.status === 'graduated') {
    return before?.status === 'graduated' ? { kind: 'kept' } : { kind: 'graduated' };
  }
  return { kind: 'scheduled', daysUntil: diffJSTCalendarDays(new Date(after.dueDate), now) };
}

export interface ReviewOutcomeRow {
  code: string;
  prefecture: string;
  label: OutcomeLabel;
  /** 回答後の status が graduated か（保存失敗は false）。 */
  graduated: boolean;
  /** undefined は表示しない（卒業済み・保存失敗）。null は上限回数に達しても卒業しない。 */
  remainingSteps?: number | null;
}

export type OutcomeCategory = 'graduated' | 'continuing' | 'saveFailed';

export interface ReviewOutcomeQuestion {
  name: string;
  kana?: string;
  mode: GameMode;
  isCorrect: boolean;
  category: OutcomeCategory;
  rows: ReviewOutcomeRow[];
}

export interface ReviewOutcomeSummaryCounts {
  graduated: number;
  continuing: number;
  saveFailed: number;
}

export interface ReviewOutcome {
  summary: ReviewOutcomeSummaryCounts;
  questions: ReviewOutcomeQuestion[];
}

export interface BuildReviewOutcomeInput {
  questions: readonly Question[];
  results: readonly QuizResultEntry[];
  meta: readonly QuestionSaveMeta[] | undefined;
  pre: readonly SrsSnapshotEntry[];
  post: readonly SrsSnapshotEntry[];
  now: Date;
}

function indexSnapshot(entries: readonly SrsSnapshotEntry[]): Map<string, SrsSnapshotEntry> {
  return new Map(entries.map((e) => [srsKeyId(e), e]));
}

function buildRow(
  target: SaveTarget,
  m: QuestionSaveMeta,
  preMap: Map<string, SrsSnapshotEntry>,
  postMap: Map<string, SrsSnapshotEntry>,
  now: Date,
): ReviewOutcomeRow | null {
  const id = srsKeyId(target);
  const pre = preMap.get(id);
  if (!pre) return null;
  const post = m.persisted ? postMap.get(id) : undefined;
  const label = resolveOutcomeLabel({
    persisted: m.persisted,
    isCorrect: m.isCorrect,
    srsSkipped: m.srsSkippedCodes.includes(target.municipalityCode),
    pre,
    post,
    now,
  });
  if (!label) return null;

  const after = post?.record;
  const row: ReviewOutcomeRow = {
    code: target.municipalityCode,
    prefecture: target.prefecture,
    label,
    graduated: after?.status === 'graduated',
  };
  if (after && after.status === 'reviewing') {
    row.remainingSteps = simulateStepsToGraduation(after, pre.everWrong || !m.isCorrect);
  }
  return row;
}

function categorize(m: QuestionSaveMeta, rows: readonly ReviewOutcomeRow[]): OutcomeCategory {
  if (!m.persisted) return 'saveFailed';
  return rows.every((r) => r.graduated) ? 'graduated' : 'continuing';
}

/**
 * 回答前後のスナップショットと保存メタから復習成果を組み立てる。
 * 整合しない入力（メタ不整合・スナップショット欠落）では null を返し、呼び出し側は従来表示に倒す。
 * サマリは1問1件で数えるので graduated + continuing + saveFailed === results.length。
 */
export function buildReviewOutcome({
  questions,
  results,
  meta,
  pre,
  post,
  now,
}: BuildReviewOutcomeInput): ReviewOutcome | null {
  if (!isSaveMetaConsistent(questions, meta, results.length)) return null;

  const preMap = indexSnapshot(pre);
  const postMap = indexSnapshot(post);
  const metaByIndex = new Map(meta.map((m) => [m.questionIndex, m]));
  const outcomeQuestions: ReviewOutcomeQuestion[] = [];

  for (const [i, result] of results.entries()) {
    const m = metaByIndex.get(i);
    const question = questions.at(i);
    if (!m || !question) return null;
    const rows: ReviewOutcomeRow[] = [];
    for (const target of questionSaveTargets(question)) {
      const row = buildRow(target, m, preMap, postMap, now);
      if (!row) return null;
      rows.push(row);
    }
    outcomeQuestions.push({
      name: result.name,
      kana: result.kana,
      mode: m.mode,
      isCorrect: m.isCorrect,
      category: categorize(m, rows),
      rows,
    });
  }

  const countOf = (category: OutcomeCategory) =>
    outcomeQuestions.filter((q) => q.category === category).length;
  const summary: ReviewOutcomeSummaryCounts = {
    graduated: countOf('graduated'),
    continuing: countOf('continuing'),
    saveFailed: countOf('saveFailed'),
  };

  return { summary, questions: outcomeQuestions };
}

export function formatOutcomeLabel(label: OutcomeLabel): string {
  switch (label.kind) {
    case 'saveFailed':
      return '⚠️ 保存失敗';
    case 'sameDay':
      return '⏸️ 同日回答済み';
    case 'relapsed':
      return '⚠️ 復習に戻りました（明日もう一度）';
    case 'retryTomorrow':
      return '🔄 明日もう一度';
    case 'kept':
      return '🎓 定着維持';
    case 'graduated':
      return '🎉 卒業（定着達成）';
    case 'scheduled':
      if (label.daysUntil <= 0) return '📅 次回 今日';
      if (label.daysUntil === 1) return '📅 次回 明日';
      return `📅 次回 ${label.daysUntil}日後`;
  }
}

export function formatRemainingSteps(steps: number | null): string {
  return steps === null ? `${MAX_SIMULATION_STEPS}回以上` : `あと${steps}回`;
}

export interface OutcomeQuestionGroup {
  /** null はシミュレーションを打ち切った問題。見出しは付けない。 */
  heading: string | null;
  questions: ReviewOutcomeQuestion[];
}

function minRemainingSteps(question: ReviewOutcomeQuestion): number | null {
  let min: number | null = null;
  for (const row of question.rows) {
    if (typeof row.remainingSteps !== 'number') continue;
    min = min === null ? row.remainingSteps : Math.min(min, row.remainingSteps);
  }
  return min;
}

/**
 * 復習完了の詳細を、残り回数の少ないまとまり順に並べる。保存順は変えない。
 * 複数県は問題を分けず、県のうち一番少ない回数のまとまりに置く。
 * 0件のまとまりは出さない。打ち切り（20回以上だけ）は見出しなしで、卒業の前。
 */
export function groupOutcomeQuestions(questions: readonly ReviewOutcomeQuestion[]): OutcomeQuestionGroup[] {
  const bySteps = new Map<number, ReviewOutcomeQuestion[]>();
  const cutoff: ReviewOutcomeQuestion[] = [];
  const graduated: ReviewOutcomeQuestion[] = [];
  const saveFailed: ReviewOutcomeQuestion[] = [];

  for (const question of questions) {
    if (question.category === 'saveFailed') {
      saveFailed.push(question);
      continue;
    }
    if (question.category === 'graduated') {
      graduated.push(question);
      continue;
    }
    const steps = minRemainingSteps(question);
    if (steps === null) {
      cutoff.push(question);
      continue;
    }
    const bucket = bySteps.get(steps);
    if (bucket) bucket.push(question);
    else bySteps.set(steps, [question]);
  }

  const groups: OutcomeQuestionGroup[] = [...bySteps.keys()]
    .sort((a, b) => a - b)
    .map((steps) => {
      const grouped = bySteps.get(steps) ?? [];
      return { heading: `あと${steps}回 ${grouped.length}問`, questions: grouped };
    });
  if (cutoff.length > 0) groups.push({ heading: null, questions: cutoff });
  if (graduated.length > 0) groups.push({ heading: `卒業 ${graduated.length}問`, questions: graduated });
  if (saveFailed.length > 0) groups.push({ heading: `保存失敗 ${saveFailed.length}問`, questions: saveFailed });
  return groups;
}

/** 定着した問題名（1問1件）。サマリの強調行に出す。 */
export function graduatedQuestionNames(outcome: ReviewOutcome): string[] {
  return outcome.questions.filter((q) => q.category === 'graduated').map((q) => q.name);
}

export const MAX_GRADUATED_NAMES = 3;

export function formatGraduatedNames(names: readonly string[]): string {
  const shown = names.slice(0, MAX_GRADUATED_NAMES).join('・');
  const rest = names.length - MAX_GRADUATED_NAMES;
  return rest > 0 ? `${shown} ほか${rest}件` : shown;
}
