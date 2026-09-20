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
 * @deprecated 029にて廃止。下部帯はお題据え置き・0px変動を維持するため、フィードバック中も伸長しない。
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
  /** `'static'` のあいだ文字を大きくするサイズ。`'motion'` では使わない。 */
  readonly enlargedTextPx: number | null;
}

const MOTION_PLAN: IntroPlan = {
  mode: 'motion',
  holdMs: 1000,
  transitionMs: 320,
  enlargedTextPx: null,
};

/**
 * 移動しない設定では、中央へ出す代わりに下端のお題の文字を大きくする。
 *
 * **帯の高さは変えない。** 地図は上下の帯に挟まれた領域いっぱいに描かれるので、
 * 帯を太らせるとその分だけ地図が縮み、戻すときに拡大率と位置がずれて見える。
 * 中央のオーバーレイが絶対配置でレイアウトに影響しないのと揃える。
 *
 * 文字を戻すときは短く緩ませる。一段で切り替えると視界の端でかくっと落ちて見える。
 * `prefers-reduced-motion` が避けたいのは移動であって寸法の変化そのものではない。
 */
const STATIC_PLAN: IntroPlan = {
  mode: 'static',
  holdMs: 2500,
  transitionMs: 240,
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
 * 下端 HUD の高さ。内容の長短やフィードバック状態では変えない。
 *
 * 029: 下部帯はお題据え置きとし、答え・補足情報はフローティングカードに集約したため、
 * フィードバック中であっても帯の高さは一切変えない（0px 変動）。
 * これにより、解答瞬間の地図コンテナ伸縮、拡大率・中心位置のズレ、
 * Google Maps ロゴや自動フォーカス矩形の破壊を完全に防止する。
 */
export function bottomBandHeightPx(
  mode: HudQuestionMode,
  _feedback?: HudFeedbackState,
): number {
  return mode === 'A' ? BOTTOM_BAND_MODE_A_PX : BOTTOM_BAND_PX;
}
