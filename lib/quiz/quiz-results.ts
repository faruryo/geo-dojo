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
}

/**
 * 1問の回答に対する表示用の結果を「1件」返す。
 *
 * Mode A で同名・複数県の市（例: 伊達市=北海道/福島, 川崎町）は採点は1回だが、
 * DB 保存は県ごと（{@link dedupeInstancesByPrefecture}）に複数件行う。保存件数で
 * 結果を数えると「19問なのに21完了」のように二重カウントされるため、表示は必ず
 * 1問1件へ正規化する。entries は同一問への回答なので isCorrect は全件同じ。
 */
export function toQuestionResult(entries: AnswerEntry[]): QuestionResult {
  const head = entries[0];
  return {
    name: head.municipality.name,
    prefecture: head.municipality.prefecture,
    correct: head.isCorrect,
  };
}
