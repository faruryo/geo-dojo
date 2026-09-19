# Contract: HUD Feedback & Height Invariant Specification

**Feature**: `029-rich-answer-feedback`  
**Date**: 2026-09-20  
**Status**: Active  
**Related**: `specs/027-map-quiz-hud`  

---

## 1. 概要

本契約は、`specs/027-map-quiz-hud` で規定された HUD 不変条件（特に下部帯の高さ固定と地図コンテナの保護）を改定・強化し、下部帯（`BottomHud`）の idle 高さ完全固定（0px 変動）と、出題中・フィードバック中のタップ状態遷移を定義する。

---

## 2. 高さ定数と関数改定 (`lib/quiz/hud-metrics.ts`)

### 2.1 廃止される定数
- `BOTTOM_BAND_FEEDBACK_PX` (56px) は**廃止（削除または非推奨）**とする。解答フィードバック中であっても帯を伸長しない。

### 2.2 高さ計算関数の契約
```typescript
/**
 * 下端 HUD の高さ（px）。
 *
 * 解答フィードバック中であっても帯の高さは一切変えない（0px 変動）。
 * これにより、解答瞬間の地図コンテナ伸縮、拡大率・中心位置のズレ、
 * Google Maps ロゴや自動フォーカス矩形の破壊を完全に防止する。
 */
export function bottomBandHeightPx(
  mode: HudQuestionMode,
  _feedback: HudFeedbackState,
): number {
  return mode === 'A' ? BOTTOM_BAND_MODE_A_PX : BOTTOM_BAND_PX;
}
```

| モード | 定常（idle）高さ | フィードバック中高さ | 変動量 |
|---|---|---|---|
| **Mode A** | 52px (`BOTTOM_BAND_MODE_A_PX`) | 52px | **0px** |
| **Mode B / C / D** | 44px (`BOTTOM_BAND_PX`) | 44px | **0px** |

---

## 3. `BottomHud` コンポーネント契約 (`components/quiz/hud/bottom-hud.tsx`)

### 3.1 Props 拡張
```typescript
export interface BottomHudProps {
  readonly content: BottomHudContent;
  readonly mode: HudQuestionMode;
  readonly submit?: {
    readonly label: string;
    readonly disabled: boolean;
    readonly onSubmit: () => void;
    readonly shortcutHint?: string;
  };
  readonly selectedCount?: number;
  /** 出題中のお題再表示ハンドラ */
  readonly onRequestIntro?: () => void;
  /** 解答フィードバック中のスキップハンドラ (FR-004a) */
  readonly onSkip?: () => void;
  readonly isFeedback?: boolean;
  readonly emphasis?: { readonly textPx: number };
  readonly restoreMs?: number;
  readonly choices?: { ... };
}
```

### 3.2 帯のお題据え置き契約
- HUD経路（Mode A・D、および地図混在セッション）では、解答後も `content.kind === 'prompt'` を維持する。
- 帯はお題文字列（Mode A: 「池田町」、Mode B: 「館山市」、Mode C: 「千葉県」、Mode D: 「館山市（千葉県）」）を表示し続ける。
- 答え（正否・よみがな・難易度・人口）はフローティングカード側に集約される。

### 3.3 タップ状態遷移とスキップヒント (FR-004a)
- **出題中（`feedback === 'idle'`）**:
  - 帯の背景タップは `onRequestIntro()` を発火（お題を中央に再表示）。
- **フィードバック中（`feedback !== 'idle'`）**:
  - 帯の背景タップは `onSkip()` を発火（次問への即時スキップ）。
  - 帯の右端に控えめなスキップ案内を表示（例: `[タップ/Spaceで次へ]`）。
  - 帯内の選択肢ボタンや確定ボタンなど既存の操作要素がある場合は、その要素自体のタップが優先される。
