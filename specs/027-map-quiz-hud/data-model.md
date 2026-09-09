# Phase 1 Data Model: 地図クイズのフルスクリーン HUD

**Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) | **Date**: 2026-09-06

本機能は永続データを持たない。DB スキーマ・Server Actions・localStorage のキーは一切変わらない。
ここで定義するのは**画面状態とレイアウト定数**であり、その所在と遷移を確定させる。

---

## 1. Immersive レイアウト状態

アプリの枠（出典 footer・`BottomNav`・`main` の下余白）を出すかどうかの1状態。

| 項目 | 内容 |
|---|---|
| 型 | `boolean` |
| 所在 | `app/(app)/app-shell.tsx` の React Context |
| 書き手 | `QuizRunner`（市区町村 A/B/C/D・復習）、`app/(app)/quiz/prefecture/page.tsx`（playing フェーズ） |
| 読み手 | `AppShell` のみ |
| 寿命 | 書き手のマウント中。アンマウントで必ず `false` へ戻す |

### 決定関数（pure）

```ts
// lib/quiz/immersive-layout.ts
export function sessionUsesImmersiveLayout(
  questions: readonly Question[],
): boolean;
```

`kind === 'A'` または `kind === 'BCD' && mode === 'D'` の問題を1問以上含むとき `true`。

**入力に含めてはいけないもの**: `modeDFailed`、`currentQuestion`、`qIdx`。
いずれもセッション中に変化するため、混ぜると FR-004 / FR-005 が壊れる（research D2）。

### 状態遷移

```
[通常レイアウト]
      │ 対象セッションの出題コンポーネントが mount
      ▼
[immersive]  ── セッション中は不変（4択の問でも、D のフォールバックでも維持）
      │ 中断 / 全問終了 / unmount
      ▼
[通常レイアウト]
```

---

## 2. 導入表示の進行状態

問題1問ぶんのお題の見せ方。`components/quiz/hud/use-question-intro.ts` のローカル state。

| 相 | 中央オーバーレイ | 下端 HUD | 継続 |
|---|---|---|---|
| `intro` | 表示（32〜36px） | `opacity: 0` | `holdMs` |
| `settling` | 下端方向へ `translateY` + `scale` しながら `opacity: 0` へ | `opacity: 1` へ | `transitionMs` |
| `steady` | 非表示 | 定常（1行 16px） | 次の遷移まで |

### 遷移

```
qIdx 変化 ──▶ intro ──(holdMs)──▶ settling ──(transitionMs)──▶ steady
                ▲                                                │
                └────────────── 下端 HUD をタップ ───────────────┘
                                （FR-022・何度でも）
```

`prefers-reduced-motion: reduce` のときは `intro` を飛ばし、`steady` から始めて
最初の `holdMs`（2500ms）だけ帯と文字を拡大する（research D3）。

### タイムライン決定関数（pure）

```ts
// lib/quiz/hud-metrics.ts
export interface IntroPlan {
  readonly mode: 'motion' | 'static';
  readonly holdMs: number;
  readonly transitionMs: number;
  readonly enlargedBandPx: number | null;  // static のときのみ
  readonly enlargedTextPx: number | null;  // static のときのみ
}

export function resolveIntroPlan(reducedMotion: boolean): IntroPlan;
```

| `reducedMotion` | `mode` | `holdMs` | `transitionMs` | `enlargedBandPx` | `enlargedTextPx` |
|---|---|---|---|---|---|
| `false` | `'motion'` | 1000 | 320 | `null` | `null` |
| `true` | `'static'` | 2500 | 0 | 64 | 24 |

---

## 3. タイマー起動フラグ

FR-024 の中核。モード D の制限時間だけを導入後に始めるための1状態。

| 項目 | 内容 |
|---|---|
| 型 | `boolean`（`armed`） |
| 所在 | `QuizRunner`。「その `qIdx` で導入が**初回**完了したか」をラッチする |
| 読み手 | `components/quiz/use-quiz-timer.ts`（新規 prop） |
| リセット | `qIdx` の変化時のみ |

**不変条件**:

- 下端タップによる再表示（FR-022）で `armed` を `false` へ戻してはならない。
  戻すと読み返すたびに持ち時間が延び、事実上の無制限になる。
- `use-quiz-state.ts` の `startTimeRef`（`answerTimeMs` の起点）と、
  `prefecture/page.tsx` の `startTimeRef`（経過タイムの起点）には**関与しない**。
  両者は現行どおり `qIdx` / `phase` の変化で更新される（FR-024・FR-050、research D4）。

---

## 4. レイアウト定数

`lib/quiz/hud-metrics.ts` に集約する。CSS 変数として HUD のルートへ流す
（契約は [contracts/hud-contract.md](./contracts/hud-contract.md)）。

| 定数 | 値 | 根拠 |
|---|---|---|
| `TOP_BAND_PX` | 44 | FR-014 の 44×44px タップ領域 |
| `BOTTOM_BAND_PX` | 44 | FR-021 |
| `BOTTOM_BAND_MODE_A_PX` | 52 | FR-021（確定ボタンの 44px タップ領域を収める） |
| `BOTTOM_BAND_FEEDBACK_PX` | 56（375px で実測） | FR-026 の最長形（62文字）は2行 30px。3行 45px でも割れず、`BOTTOM_BAND_MODE_A_PX`(52) を下回らない値。research D11 |
| `INTRO_TEXT_PX` | 34 | FR-020 の 32〜36px の中央値 |
| `STEADY_TEXT_PX` | 16 | FR-021 |
| `MIN_TEXT_PX` | 12 | FR-039 |

### 帯の高さ決定関数（pure）

```ts
export function bottomBandHeightPx(
  mode: 'A' | 'BCD',
  feedback: FeedbackState,
): number;
```

- `feedback !== 'idle'` → `BOTTOM_BAND_FEEDBACK_PX`（モードによらず同じ。SC-008）
- `mode === 'A'` → `BOTTOM_BAND_MODE_A_PX`
- それ以外 → `BOTTOM_BAND_PX`

セーフエリアのインセットはこの値に**含めない**。帯の外側に `env(safe-area-inset-*)` として
積む（research D6、SPEC-2）。

---

## 5. 色トークン

| 用途 | 値 | `#111111` 上のコントラスト |
|---|---|---|
| HUD 背景 | `#111111`（完全不透明。FR-035） | — |
| HUD の文字 | `#fafafa` | 18.1:1 |
| 正解アイコン | `#22c55e` | 9.1:1（非テキスト基準 3:1） |
| 不正解アイコン | `#ef4444` | 5.02:1（非テキスト基準 3:1） |
| 地図の正解塗り | `#4a7c59` | 3.88:1 — **文字色に使わない**（FR-038） |

---

## 6. 廃止する表示要素

FR-040 の表に従い、次は出題中の DOM から消える。

| 要素 | 現在地 |
|---|---|
| 正解数（`N 正解`） | `components/quiz/quiz-header.tsx:31` |
| 難易度バッジ | `components/quiz/quiz-question-card.tsx:20-42` |
| 「N か所あります」「あと N か所」（A） | `quiz-runner.tsx:96-106`（確定ボタンのラベルへ統合） |
| 選択中の都道府県バッジ列（A） | `components/quiz/views/mode-a-view.tsx:70-78`（件数1行へ集約） |
| 出典 footer | `app/(app)/layout.tsx:22-27`（immersive のときのみ非表示。削除ではない） |
