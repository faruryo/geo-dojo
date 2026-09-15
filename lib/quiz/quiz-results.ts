import { locationLabel, locationKana } from './location-labels';
import type { GameMode, Municipality } from './municipality-data';

/** 1回の回答ハンドラが保存する単位。Mode A の複数県同名市は県ごとに分かれる。 */
export interface AnswerEntry {
  municipality: Municipality;
  isCorrect: boolean;
  mode: GameMode;
}

/** 結果画面・進捗カウントに使う表示用の1問の結果。 */
export interface QuestionResult {
  name: string;
  prefecture: string;
  correct: boolean;
  kana?: string;
}

/**
 * 1問の回答に対する表示用の結果を「1件」返す。
 *
 * Mode A で同名・複数県の市（例: 伊達市=北海道/福島, 川崎町）は採点は1回だが、
 * DB 保存は県ごと（{@link dedupeInstancesByPrefecture}）に複数件行う。保存件数で
 * 結果を数えると「19問なのに21完了」のように二重カウントされるため、表示は必ず
 * 1問1件へ正規化する。entries は同一問への回答なので isCorrect は全件同じ。
 *
 * Mode D（場所当て）では政令指定都市の行政区が出題されるため、表示名・読み仮名に
 * locationLabel / locationKana を適用して区単位の表記に正規化する。
 */
export function toQuestionResult(entries: readonly AnswerEntry[]): QuestionResult {
  const head = entries[0];
  const isModeD = head.mode === 'D';
  return {
    name: isModeD
      ? locationLabel(head.municipality.code, head.municipality.name)
      : head.municipality.name,
    prefecture: head.municipality.prefecture,
    correct: head.isCorrect,
    kana: isModeD
      ? locationKana(head.municipality.code, head.municipality.kana)
      : head.municipality.kana,
  };
}

export interface WeakResultItem {
  readonly name: string;
  readonly detail: string;
}

/**
 * 結果画面の苦手市区町村一覧（QuizResultCard.weakItems）向けに
 * 1問の結果を「名称」と「読み仮名 / 都道府県」へ変換する。
 */
export function toWeakResultItem(result: QuestionResult): WeakResultItem {
  return {
    name: result.name,
    detail: result.kana ? `${result.kana} / ${result.prefecture}` : result.prefecture,
  };
}

