# Contract: Feedback Card Component Interface

**Feature**: `029-rich-answer-feedback`  
**Date**: 2026-09-20  
**Status**: Active  

---

## 1. 概要

本契約は、HUD経路（Mode A・Mode D、および地図混在セッション）において、ステージ領域上部に重ねて表示するフローティングカード（`FloatingFeedbackCard`）の props、DOM 構造、サイズ制約、およびアクセシビリティ要件を定義する。

---

## 2. コンポーネント定義

### 2.1 Props Interface

```typescript
export interface FeedbackItem {
  readonly prefecture: string;
  readonly name: string;
  readonly kana?: string;
  readonly formattedPopulation: string | null;
}

export interface FloatingFeedbackCardProps {
  /** 正解・不正解 */
  readonly isCorrect: boolean;
  /** 連続正解数 (1〜) */
  readonly streak: number;
  /** 代表難易度 */
  readonly difficulty?: Difficulty;
  /** 表示対象自治体アイテム（通常は1件、Mode A 同名多県時は複数件） */
  readonly items: readonly FeedbackItem[];
  /** カード本体タップ時のスキップハンドラ */
  readonly onSkip?: () => void;
}
```

---

## 3. スタイル & レイアウト不変条件 (375px Mobile First)

| 項目 | 規定値 | 根拠・目的 |
|---|---|---|
| **配置** | `absolute top-2 left-1/2 -translate-x-1/2 z-20` | Stage最前面・上部中央配置。地図中心の視認性を最大化 |
| **幅** | `w-[calc(100%-32px)] max-w-[340px]` | 375px幅で左右16pxマージンを確保 |
| **背景** | `bg-[#111111]`（不透明） | 下地のGoogle Maps/地図タイルの明度を拾わずコントラスト保証 |
| **枠線・角丸** | `border border-white/10 rounded-xl shadow-lg` | 落ち着いたダークトーンの外観 |
| **通常時高さ** | 約 68px | 単一自治体表示時の標準高さ |
| **最大高さ** | `max-h-[112px]` | 同名4県（池田町）時も 112px 内に収める（スクロールバー不可） |
| **タップ領域** | `pointer-events: auto cursor-pointer` | カード本体をタップすると即時スキップ |
| **アクセシビリティ** | `aria-live="polite"` | スクリーンリーダーへの通知 |

---

## 4. DOM 構造と描画バリアント

### 4.1 単一自治体の場合（Mode B/C/D、および Mode A 単県）

```html
<div
  role="status"
  aria-live="polite"
  class="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 z-20 flex w-[calc(100%-32px)] max-w-[340px] flex-col gap-1 rounded-xl border border-white/10 bg-[#111111] p-2.5 text-[#fafafa] shadow-lg cursor-pointer"
>
  <!-- 1行目: 正否バッジ + 称賛/不正解ラベル + 連続正解チップ -->
  <div class="flex items-center gap-1.5 text-xs">
    <span class="font-bold text-emerald-400">🎉 正解！</span>
    <span class="font-semibold text-white/90">お見事！</span>
    <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
      3連続
    </span>
  </div>

  <!-- 2行目: 自治体名・よみがな + 難易度 + 人口 -->
  <div class="flex items-baseline justify-between gap-2 text-xs">
    <div class="flex items-baseline gap-1.5 truncate">
      <span class="font-bold text-sm text-white truncate">館山市</span>
      <span class="text-[11px] text-white/70">たてやまし</span>
      <span class="text-[10px] text-white/50">（千葉県）</span>
    </div>
    <div class="flex shrink-0 items-center gap-2 text-[11px] text-white/80">
      <span class="text-amber-400/90 font-medium">☆☆ 中級</span>
      <span class="text-white/30">|</span>
      <span>約4.4万人</span>
    </div>
  </div>
</div>
```

### 4.2 Mode A 同名多県の場合（例: 池田町・4県）

```html
<div
  role="status"
  aria-live="polite"
  class="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 z-20 flex w-[calc(100%-32px)] max-w-[340px] flex-col gap-1 rounded-xl border border-white/10 bg-[#111111] p-2 text-[#fafafa] shadow-lg cursor-pointer"
>
  <!-- 1行目: 正否 + 称賛 + 代表難易度 -->
  <div class="flex items-center justify-between text-xs">
    <div class="flex items-center gap-1.5">
      <span class="font-bold text-emerald-400">🎉 正解！</span>
      <span class="font-semibold text-white/90">お見事！</span>
      <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
        3連続
      </span>
    </div>
    <span class="text-[10px] text-amber-400/90 font-medium">☆☆☆ 上級</span>
  </div>

  <!-- 2行目以降: 2x2グリッドで全4県をコンパクト表示（高さ 112px 内・スクロールなし） -->
  <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] border-t border-white/10 pt-1">
    <div class="flex justify-between truncate">
      <span class="text-white/90">北海道 (いけだ)</span>
      <span class="text-white/70">約0.6万人</span>
    </div>
    <div class="flex justify-between truncate">
      <span class="text-white/90">福井県 (いけだ)</span>
      <span class="text-white/70">約0.2万人</span>
    </div>
    <div class="flex justify-between truncate">
      <span class="text-white/90">長野県 (いけだ)</span>
      <span class="text-white/70">約1.3万人</span>
    </div>
    <div class="flex justify-between truncate">
      <span class="text-white/90">岐阜県 (いけだ)</span>
      <span class="text-white/70">約2.3万人</span>
    </div>
  </div>
</div>
```

---

## 5. アクセシビリティ要件 (FR-006e)

1. `aria-live="polite"` を指定。
2. スクリーンリーダーへの通知文言は、2.0s の自動遷移時間内に読み終えられるよう、連続正解数を除外した主要情報のみとする：
   - 単県: `正解！ 館山市、たてやまし（千葉県）、難易度: ☆☆ 中級、人口: 約4.4万人`
   - 不正解: `不正解。正解は館山市、たてやまし（千葉県）、難易度: ☆☆ 中級、人口: 約4.4万人`
