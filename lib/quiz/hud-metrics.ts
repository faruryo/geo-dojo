/**
 * 出題中のフルスクリーン HUD のレイアウト定数と、そこから導かれる判断。
 *
 * setTimeout や matchMedia はここに置かない。呼び出し側の hook に残し、
 * ここは入力から値を返すだけにする。
 */

/** 上端 HUD の高さ。中断ボタンの 44×44px タップ領域を収める。 */
export const TOP_BAND_PX = 44;

/** 下端 HUD の定常状態の高さ。 */
export const BOTTOM_BAND_PX = 44;

/** 県当て（A）の下端 HUD。確定ボタンの 44px タップ領域を収めるぶん高い。 */
export const BOTTOM_BAND_MODE_A_PX = 52;

/**
 * 正否フィードバック中の下端 HUD の高さ。
 *
 * 375px 幅での実測に基づく。`municipality_master` 全件から feedback-labels の
 * 最長形を出すと `池田町 （正解: 北海道: … / 長野県: いけだまち）`（62文字）で、
 * 折り返して2行・30px（行の高さ 15px）になる。
 *
 * その 30px に対して余裕を持たせた値にしている。データが増えて3行（45px）に
 * なっても割れず、かつ県当て（A）の定常 52px を下回らないため、解答した瞬間に
 * 帯が縮んで地図が広がり、また戻るという動きが起きない。
 */
export const BOTTOM_BAND_FEEDBACK_PX = 56;

/** 出題直後に画面中央へ大きく出すお題の文字サイズ。 */
export const INTRO_TEXT_PX = 34;

/** 定常状態のお題の文字サイズ。 */
export const STEADY_TEXT_PX = 16;

/** HUD 内の最小文字サイズ。これを下回らせない。 */
export const MIN_TEXT_PX = 12;

/** 下端 HUD の高さを決めるのに必要なフィードバックの状態。 */
export type HudFeedbackState = 'idle' | 'correct' | 'incorrect';

/** 下端 HUD の高さを決めるのに必要なモードの区別。 */
export type HudQuestionMode = 'A' | 'BCD';

export interface IntroPlan {
  /** `'motion'` は中央から下端へ寄せる。`'static'` は移動しない。 */
  readonly mode: 'motion' | 'static';
  /** 縮小移動を始めるまでの待ち時間。 */
  readonly holdMs: number;
  /** 定常へ落ち着くまでにかける時間。`'motion'` では縮小移動、`'static'` では寸法の緩和。 */
  readonly transitionMs: number;
  /** `'static'` のあいだ帯を広げる高さ。`'motion'` では使わない。 */
  readonly enlargedBandPx: number | null;
  /** `'static'` のあいだ文字を大きくするサイズ。`'motion'` では使わない。 */
  readonly enlargedTextPx: number | null;
}

const MOTION_PLAN: IntroPlan = {
  mode: 'motion',
  holdMs: 1000,
  transitionMs: 320,
  enlargedBandPx: null,
  enlargedTextPx: null,
};

/**
 * 移動しない設定でも、拡大した帯を定常へ戻すときは寸法を緩ませる。
 *
 * 0 にすると 2.5 秒後に 64px→44px・24px→16px が一段で切り替わり、視界の端で
 * かくっと落ちて見える。`prefers-reduced-motion` が避けたいのは移動であって
 * 寸法の変化そのものではないため、短い緩和は付けてよい（FR-023 / SC-011）。
 */
const STATIC_PLAN: IntroPlan = {
  mode: 'static',
  holdMs: 2500,
  transitionMs: 240,
  enlargedBandPx: 64,
  enlargedTextPx: 24,
};

/**
 * お題の導入表示の進め方を決める。
 *
 * `prefers-reduced-motion: reduce` のときは移動を一切行わず、最初から下端に置いたまま
 * 帯と文字を大きくして見せる。
 */
export function resolveIntroPlan(reducedMotion: boolean): IntroPlan {
  return reducedMotion ? STATIC_PLAN : MOTION_PLAN;
}

/**
 * 下端 HUD の高さ。内容の長短では変えない。
 *
 * フィードバック中はモードによらず同じ高さにする。正解・不正解や文言の長さで
 * 帯が伸縮すると、地図コンテナの高さが毎問変わって自動フォーカスが安定しない。
 */
export function bottomBandHeightPx(
  mode: HudQuestionMode,
  feedback: HudFeedbackState,
): number {
  if (feedback !== 'idle') return BOTTOM_BAND_FEEDBACK_PX;
  return mode === 'A' ? BOTTOM_BAND_MODE_A_PX : BOTTOM_BAND_PX;
}
