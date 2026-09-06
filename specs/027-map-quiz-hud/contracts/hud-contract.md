# Phase 1 Contract: HUD の内部インターフェース

**Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Date**: 2026-09-06

本機能は外部 API を公開しない。ここで固定するのは、**layout ↔ 出題画面 ↔ HUD 部品**の
3者が守る内部契約である。実装がこの形から外れると、FR-004（セッション単位の切替）と
FR-032（帯の密着）が保証できなくなる。

---

## C1: Immersive レイアウト Context

**提供**: `app/(app)/app-shell.tsx`

```ts
/** 出題画面が呼ぶ唯一の API。mount 中だけ枠を外し、unmount で必ず戻す。 */
export function useImmersiveLayout(active: boolean): void;
```

**契約**:

- `active` が `true` の間、`AppShell` は次の3つを描画しない／無効化する。
  - 出典 `<footer>`
  - `<BottomNav />`
  - `<main>` の `paddingBottom`（`6rem` → `0`）
- あわせて `<main>` の `overflowY` を `auto` → `hidden` にする。
  端数によるスクロールが SC-002（追加スクロールなしで押せる）を破るため。
- `useImmersiveLayout` は effect のクリーンアップで必ず `false` に戻す。
  中断・完了・エラー境界のいずれで抜けても枠が戻ること（FR-007）。
- 同時に `true` を要求する呼び出し元は最大1つ。複数を想定した参照カウントは持たない。

**呼び出し側**:

| 画面 | 渡す値 |
|---|---|
| `components/quiz/quiz-runner.tsx` | `sessionUsesImmersiveLayout(questions)` |
| `app/(app)/quiz/prefecture/page.tsx` | `phase === 'playing'` |

---

## C2: 画面の骨格

immersive 中の出題画面は、必ずこの3段構造にする。

```tsx
<div className="fixed inset-0 flex flex-col bg-[#111111]">
  <TopHud … />                                  {/* 高さ 44px + safe-area-inset-top */}
  <div className="flex-1 min-h-0 relative">     {/* 地図。帯の内側に閉じる */}
    …map…
  </div>
  <BottomHud … />                               {/* 44 / 52 / 72px + safe-area-inset-bottom */}
</div>
```

**契約**:

- 地図コンテナは `flex-1 min-h-0`。高さを固定値で計算しない。
  これにより FR-032（Google ロゴが帯の直上に可視）と FR-034（自動フォーカスの可視矩形）が
  副作用として満たされる（research D5 / D8）。
- 帯と地図の間に隙間を作らない。`gap` を持たせない。
- 帯の背景は `#111111` の完全不透明。`bg-*/NN`・`backdrop-blur`・`bg-gradient-*` を使わない（FR-035）。
- 中央のオーバーレイ（`QuestionIntro`）はこの3段の**兄弟**として絶対配置し、
  地図コンテナの中に入れない。地図の transform の影響を受けさせないため。

---

## C3: `TopHud`

```ts
interface TopHudProps {
  readonly currentIndex: number;      // 0-based
  readonly totalQuestions: number;
  readonly onAbort: () => void;       // 確認ダイアログは TopHud の内側で出す
  readonly timer?:
    | { readonly kind: 'countdown'; readonly secondsLeft: number; readonly totalSeconds: number }
    | { readonly kind: 'elapsed'; readonly elapsedMs: number };
}
```

**契約**:

- `timer` が `undefined` のとき、時間表示のための領域を確保しない（FR-013）。
  空の `<div>` を高さ付きで置かない。
- `kind: 'countdown'` は残量が減るバー（FR-011）。`kind: 'elapsed'` は数値（FR-012）。
  同時に両方は出ない。
- 中断は 44×44px 以上のタップ領域を持ち、押下で確認を1段挟む（FR-014）。
  1タップで `onAbort` を呼ばない。
- ミュートは既存の `components/quiz/mute-toggle.tsx` をそのまま使う。
- **正解数と難易度バッジを受け取らない**（FR-040 で廃止）。props に足してはならない。

---

## C4: `BottomHud`

```ts
type BottomHudContent =
  | { readonly kind: 'prompt'; readonly title: string; readonly subTitle?: string }
  | { readonly kind: 'feedback'; readonly correct: boolean; readonly detail: string }
  | { readonly kind: 'choices'; /* 復習セッション中の4択（FR-029） */ … }
  | { readonly kind: 'error'; readonly message: string };  // 地図読み込み失敗の1行

interface BottomHudProps {
  readonly content: BottomHudContent;
  readonly mode: 'A' | 'BCD';
  readonly submit?: {                 // 県当て A のみ
    readonly label: string;           // 「解答する」/「あと N か所選択」に統合（FR-040）
    readonly disabled: boolean;
    readonly onSubmit: () => void;
  };
  readonly selectedCount?: number;    // A の選択件数を1行で（FR-028）
  readonly onRequestIntro: () => void; // 帯タップでお題を再表示（FR-022）
}
```

**契約**:

- 高さは `bottomBandHeightPx(mode, feedback)` の戻り値のみで決まる。
  内容の長短で伸縮しない（FR-027 / SC-008）。
- `kind: 'feedback'` の `detail` は `lib/quiz/feedback-labels.ts` の出力をそのまま渡す。
  よみがなを落とさない（FR-026）。
- 正否は文字色ではなく `FeedbackLine` の色付きアイコンで示す。
  帯の中の文字はすべて `#fafafa`（FR-037）。
- `onRequestIntro` は帯のどこをタップしても発火してよいが、
  `submit` ボタンと4択ボタンの上では発火させない（操作の競合を避ける）。
- 再表示できることを示す手掛かり（拡大アイコン）を `kind: 'prompt'` のときに出す（FR-022）。

---

## C5: `useQuizTimer` の変更

```ts
interface UseQuizTimerProps {
  readonly currentQuestion: Question | null;
  readonly feedback: FeedbackState;
  readonly modeDFailed: boolean;
  readonly qIdx: number;
  readonly onTimeout: () => void;
  readonly armed: boolean;   // ← 追加
}
```

**契約**:

- `armed === false` の間はインターバルを張らない。`timeLeft` は `TIME_LIMIT_SEC` のまま。
- `armed` は「その `qIdx` で導入表示が**初回**完了したか」。
  下端タップによる再表示（FR-022）で `false` に戻さない。
- この prop は**モード D の制限時間にのみ影響する**。`use-quiz-state.ts` の `startTimeRef` と
  `prefecture/page.tsx` の経過タイムには一切関与しない（FR-024 / FR-050）。

**回帰の見張り**: `__tests__/lib/quiz/answer-time.test.ts` が既にあり、
`answerTimeMs` の起点が変わっていないことを守る。ここを赤くする変更を入れてはならない。

---

## C6: CSS 変数

HUD のルート（C2 の最外 `div`）に流す。Tailwind の任意値から参照する。

| 変数 | 供給元 |
|---|---|
| `--hud-top-h` | `TOP_BAND_PX` |
| `--hud-bottom-h` | `bottomBandHeightPx(mode, feedback)` |
| `--hud-bg` | `#111111` |
| `--hud-fg` | `#fafafa` |

セーフエリアは変数に含めず、各帯が `env(safe-area-inset-*)` を自分の padding として持つ
（research D6）。
