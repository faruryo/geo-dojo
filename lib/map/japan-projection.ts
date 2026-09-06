/**
 * 全国地図の投影とフレーミング。
 *
 * `ComposableMap` と `calculateFocusTransform` の両方がこの値を使う。片方だけ変えると、
 * 不正解後の自動フォーカスが実際の描画とずれた位置へ寄る。
 *
 * 枠は47都道府県の本体ポリゴンの外形がすべて入る範囲に詰めてあり、与那国島や択捉島の
 * ような離れた小島は枠外へ出る。県当ての操作には各県の本体が見えれば足りる。
 * 重心基準で詰めると北海道の東部が右端で切れるので、外形基準から動かさない。
 *
 * 沖縄を別枠へ切り出すと（天気予報で使われる形）、南へ伸びていた分が失われて縦横比が
 * 0.752 から悪化し、縦画面での描画面積がむしろ減る。切り出さない。
 */

export const JAPAN_VIEWBOX_WIDTH = 400;

/** 幅と SCALE から一意に決まる。単独で変えると緯度方向が伸縮する。 */
export const JAPAN_VIEWBOX_HEIGHT = 532;

export const JAPAN_PROJECTION_SCALE = 1221;

export const JAPAN_PROJECTION_CENTER: readonly [number, number] = [136.72, 36.44];
