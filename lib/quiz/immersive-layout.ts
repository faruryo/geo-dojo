/**
 * 出題中のフルスクリーン枠の適用可否をセッション単位で決める。
 *
 * 判定はセッション開始時に確定する `questions` だけから導く。`modeDFailed` や
 * `currentQuestion` のような出題中に変化する値を混ぜると、モード D が4択へ
 * フォールバックした瞬間にボトムナビが復帰して点滅する。
 */

/** 判定に必要な最小の形。`components` 側の `Question` をそのまま渡せる。 */
export type ImmersiveLayoutQuestion =
  | { readonly kind: 'A' }
  | { readonly kind: 'BCD'; readonly mode: 'B' | 'C' | 'D' };

/** 地図を操作して答える問題か（県当て A・場所当て D）。 */
function isMapQuestion(question: ImmersiveLayoutQuestion): boolean {
  return question.kind === 'A' || question.mode === 'D';
}

/**
 * セッションに地図問題が1問でも含まれるならフルスクリーン枠を使う。
 * 4択だけのセッションは現行の通常レイアウトのままとする。
 */
export function sessionUsesImmersiveLayout(
  questions: readonly ImmersiveLayoutQuestion[],
): boolean {
  return questions.some(isMapQuestion);
}
