# Implementation Plan: クイズ解答時のリッチフィードバック演出と補足情報表示

**Branch**: `029-rich-answer-feedback` | **Date**: 2026-09-20 | **Spec**: [specs/029-rich-answer-feedback/spec.md](file:///Users/faru/geo-dojo/specs/029-rich-answer-feedback/spec.md)

**Input**: Feature specification from `specs/029-rich-answer-feedback/spec.md`

---

## Summary

クイズ解答後フィードバックにおいて、正解の達成感を高める音・視覚演出と、地理学習を深める補足情報（難易度・人口・よみがな）を両立して提供する。市区町村クイズ（A〜D、復習）に加え、都道府県クイズ（通常モード・タイムアタックモード）にも統一適用する。
実機 375px プロトタイプ検証に基づき、下部帯（`BottomHud`）はお題据え置き（出題中 idle 高さ 44px / Mode A 52px 完全固定・解答瞬間の地図コンテナリサイズ 0px）とし、答えと補足情報は `TopHud` 直下の不透明フローティングカード（モバイル: 最大幅 340px、最大高 112px / PC版 `md:`: 最大幅 480px、最大高 160px）に集約する。
反復学習のテンポを崩さないため、スキップ操作（帯タップ・カードタップ・Spaceキー）と次問切り替え直後 250ms の誤タップガードを導入し、連続正解（Streak）に応じた段階的ピッチ上昇和音 SE、および 5連続正解達成時のみ発火する CSS 紙吹雪演出を提供する。都道府県クイズでは問題進行（`qIdx` 変化）に応じた地図拡大フレーミングの確実なリセットを保証する。

実装はリスク昇順の順序を厳守し、**US1（補足情報表示・HUD 0px 不変条件）→ US2（進行制御・スキップ・誤タップガード）→ US3（演出・和音 SE・紙吹雪・a11y）** の 3 フェーズで推進する。

---

## Technical Context

**Language/Version**: TypeScript 5 (Strict mode), Node 25, pnpm 10  
**Primary Dependencies**: Next.js 15.2.6 (App Router / React 19), Tailwind CSS v4, Lucide React, Web Audio API (native, oscillator synthesis)  
**Storage**: Supabase (PostgreSQL) + Drizzle ORM（本機能での新規スキーマ変更なし。既存の `municipality_master.population` 列を使用）  
**Testing**: Vitest (`pnpm test`), TypeScript check (`pnpm type-check`), ESLint (`pnpm lint`, `pnpm lint:ratchet`)  
**Target Platform**: Mobile Web / PWA (375px mobile-first, Safari / Chrome) & Desktop (`md:` 768px+)  
**Project Type**: Next.js Web Application / PWA  
**Performance Goals**: 375px 実機において 50ms 超のロングタスク（フレーム落ち）ゼロ。スキップ入力から 50ms 以内の次問遷移開始。  
**Constraints**: 
- 下部帯の高さ変動 0px（出題中と同一の通常 44px / Mode A 52px 完全固定、`BOTTOM_BAND_FEEDBACK_PX` 廃止）。
- 紙吹雪演出は外部ライブラリ不使用、純粋 CSS による軽量 DOM パーティクル。
- 紙吹雪の発火条件は **5連続達成時のみ（`streak === 5`）**、6連続以降は非表示（1セッション最大1回）。
- 次問切り替え直後 250ms 間は全モード共通で回答入力を無視（誤タップガード）。
- 自動遷移時間は保存完了後一律 2.0秒（2,000ms）。都道府県クイズのタイムアタックモードは正解 500ms、誤答 900ms。
- 都道府県クイズで誤答時に地図が拡大した場合、次問進行時に確実に拡大フレーミングをリセット（`qIdx` 連動）。
- PC画面（`md:` 768px以上）ではカードサイズを最大幅 480px、最大高 160px に拡大。
- `prefers-reduced-motion: reduce` の完全尊重。
- スクリーンリーダー（`aria-live="polite"`）では 2.0s 内に確実に読み終えるため連続正解数は除外。

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 要件・規約 | 適合性確認 | 判定 |
|---|---|---|---|
| **I. セキュリティ & コンプライアンス** | APIキー露出禁止、Next.js 15.2.6+ 厳守 | 新規APIキー追加なし。Next.js 15.2.6 を維持。 | **PASS** |
| **II. アーキテクチャ & パフォーマンス** | TanStack Query (Read) / Server Actions (Write)、TopoJSON非同期、DBインデックス維持 | 人口データは既存 `getMunicipalityMaster` 経由で取得。新規DBクエリ不要。Web Audio合成と純粋CSSでバンドル追加なし。 | **PASS** |
| **III. ロジック & UI** | 375px 基準モバイルファースト、ダークモード（`#111111`） | フローティングカード最大幅 340px（左右17.5pxマージン）、背景 `#111111` 不透明。池田町4県でも最大高 112px 内に収める。下部帯は 44px/52px 完全固定（0px 変動）。 | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/029-rich-answer-feedback/
├── spec.md              # 仕様書（確定済み）
├── plan.md              # 本実装計画
├── research.md          # Phase 0: 技術決定とトレードオフ分析
├── data-model.md        # Phase 1: データモデル・Streak計算・状態遷移
├── quickstart.md        # Phase 1: 手動・自動テスト検証手順
├── contracts/           # Phase 1: インターフェース契約
│   ├── feedback-card-contract.md
│   ├── hud-feedback-contract.md
│   └── sound-effects-contract.md
└── tasks.md             # Phase 2: タスク一覧（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
lib/
├── quiz/
│   ├── municipality-data.ts           # Municipality 型に population?: number 追加
│   ├── municipality-population.ts     # 新設: 政令市合算・人口フォーマット純粋関数
│   ├── streak.ts                      # 新設: 連続正解数算出純粋関数
│   ├── hud-metrics.ts                 # BOTTOM_BAND_FEEDBACK_PX 廃止、0px 変動保証
│   └── sound-effects.ts               # 和音 SE（0.35s）、ピッチ上昇、ファンファーレ合成
components/
├── quiz/
│   ├── hud/
│   │   ├── floating-feedback-card.tsx # 新設: 上部フローティング補足情報カード
│   │   ├── bottom-hud.tsx             # お題据え置き、onSkip ハンドラ、スキップ案内
│   │   └── immersive-quiz-view.tsx    # フローティングカード配置、お題据え置き結合
│   ├── effects/
│   │   └── confetti-overlay.tsx       # 新設: 純粋 CSS 紙吹雪コンポーネント (5連続のみ)
│   ├── quiz-question-card.tsx         # カード経路（4択）の人口追加・バウンス
│   ├── use-quiz-actions.ts            # スキップ調停 (skipRequestedRef)、誤タップガード (250ms)
│   ├── use-quiz-session.ts            # streak 導出、スキップハンドラ統合
│   └── quiz-runner.tsx                # 全体結合
app/
└── (app)/quiz/
    ├── municipality/[mode]/page.tsx   # population マッピング追加
    └── review/page.tsx                # population マッピング追加
__tests__/
├── lib/quiz/
│   ├── municipality-population.test.ts # 政令市合算、欠損防御、フォーマット単体テスト
│   ├── streak.test.ts                  # 連続正解数算出・リセット単体テスト
│   ├── hud-metrics.test.ts             # 0px 変動保証テスト
│   └── sound-effects.test.ts           # 和音パラメータ・再生時間・ピッチ計算テスト
└── components/quiz/
    ├── floating-feedback-card.test.tsx # カード描画・多県併記・タップスキップテスト
    └── use-quiz-actions-advance.test.ts# スキップ保留・即時遷移・250msガードテスト
```

**Structure Decision**: 既存のディレクトリ構造（`lib/quiz/`, `components/quiz/`）に従い、UIと純粋ロジックを分離。Web Audio SE は `lib/quiz/sound-effects.ts` に集約。

---

## Complexity Tracking

> **Constitution Check 違反なし（N/A）**

---

## Implementation Phases (Risk Ascending Order)

ユーザーの重要方針に基づき、リスク昇順（US1 → US2 → US3）の順序で実装を進める。

### Phase 1: User Story 1 - 解答時の補足情報表示（難易度・人口・HUD 0px 固定）(P1)

- **目標**: 既存データで完結し、地図リサイズ破壊のない安全な表示基盤を確立する。
- **タスク内容**:
  1. `lib/quiz/municipality-data.ts` の `Municipality` 型に `population?: number` を追加。
  2. `app/(app)/quiz/municipality/[mode]/page.tsx` および `review/page.tsx` で `population: m.population ?? undefined` をマッピング。
  3. `lib/quiz/municipality-population.ts` を作成:
     - `buildDesignatedCityPopulationMap`: 政令市の全区人口合算（1区でも欠損時は `null`）。
     - `formatPopulation`: 1万人以上の四捨五入（`約○.○万人`）および1万人未満カンマ区切り（`約○,○○○人`）。
     - `resolveFeedbackItems`: 単県・政令市・同名多県（池田町4県等）に応じた補足アイテムリストの生成。
  4. `lib/quiz/hud-metrics.ts` の改修:
     - `BOTTOM_BAND_FEEDBACK_PX`（56px）を廃止。
     - `bottomBandHeightPx` は常に `mode === 'A' ? 52 : 44`（0px 変動）を返すよう変更。
  5. `components/quiz/hud/floating-feedback-card.tsx` を新設:
     - Stage最前面（`absolute top-2 left-1/2 -translate-x-1/2 z-20`）、幅最大 340px、背景 `#111111`。
     - 通常時高さ約 68px、最大高さ 112px（池田町4県時もスクロールなし）。
     - `pointer-events: auto` でカードタップ時の `onSkip` をサポート。
     - `aria-live="polite"`（主要情報のみ、連続正解数は除外）。
  6. `components/quiz/hud/bottom-hud.tsx` および `immersive-quiz-view.tsx` の改修:
     - 解答フィードバック中もお題表示（`kind: 'prompt'`）のまま据え置き。
     - フローティングカードを Stage 内にマウント。
  7. `components/quiz/quiz-question-card.tsx`（4択カード経路）の補足情報表示拡張。
  8. 単体・表示回帰テストの作成（`municipality-population.test.ts`, `hud-metrics.test.ts`, `floating-feedback-card.test.tsx`）。

---

### Phase 2: User Story 2 - テンポと閲覧の両立（進行制御・スキップ・誤タップガード）(P2)

- **目標**: 非同期保存との調停、誤タップ防止、テンポの良いスキップ操作を実現する。
- **タスク内容**:
  1. `lib/quiz/streak.ts` を新設:
     - `calculateStreak(results)`: `results` 末尾から連続する `correct === true` を算出。
  2. `components/quiz/use-quiz-actions.ts` の改修:
     - 自動遷移時間を保存完了後一律 **2.0秒（2,000ms）** に統一。
     - `skipRequestedRef` を新設し、非同期保存中のスキップ要求を保留、保存完了即時遷移を実現（FR-004b）。
     - 保存完了後のタイマー待機中のスキップ入力で即座に `advanceQuestion` を呼び出す。
     - `guardUntilRef` を新設し、次問遷移後 250ms 間は全回答アクション（`handleModeASubmit`, `handleChoice`, `handleDTap`）を無視する誤タップガードを導入（FR-004d）。
     - Space/Enter キーリピート抑止（`event.repeat === true` を無視、FR-004c）。
  3. `components/quiz/hud/bottom-hud.tsx` のタップ状態遷移:
     - 出題中: 帯タップでお題再表示（`onRequestIntro`）。
     - フィードバック中: 帯タップで即時スキップ（`onSkip`）を発火。右端に控えめな案内表示。
     - 地図ドラッグ・ズーム、TopHud操作からのスキップ除外を保証。
  4. 単体・非同期遷移テストの作成（`use-quiz-actions-advance.test.ts`）。

---

### Phase 3: User Story 3 - 達成感を高める正解演出（和音 SE・ファンファーレ・紙吹雪）(P3)

- **目標**: 反復学習を盛り上げる演出段階（グラデーション）を導入し、a11y・アクセシビリティを保証する。
- **タスク内容**:
  1. `lib/quiz/sound-effects.ts` の刷新:
     - 正解 SE を単音から 0.35秒以内のメジャーコード和音に刷新。
     - 連続正解数（1〜4問目）に応じた全音単位のピッチ上昇ロジック（最大4段階）。
     - 5連続達成時のみオクターブ上を加えたファンファーレ和音（0.34秒）を合成再生。
     - 6連続以降は最高音程の和音 SE を維持。
     - ミュート設定（`isSoundMuted()`）の完全遵守。
  2. 称賛ラベルとチップの段階表示:
     - 「正解！」→「いいね！」→「お見事！」→「すごい！」→「完璧！」のステップアップ。
     - 2連続以降のカード内「n連続」チップ表示（6連続以降も維持）。
     - 称賛ラベルのバウンスアニメーション（`scale`）。
  3. `components/quiz/effects/confetti-overlay.tsx` を新設:
     - 純粋 CSS による DOM パーティクル（16〜20個）。
     - 発火条件: **`streak === 5` のみ**（6連続以降は非表示、1セッション最大1回、FR-006b）。
     - 1.5秒でフェードアウトしアンマウント。
  4. 地図ポリゴンの正解パルス演出:
     - Mode A (`JapanMap.tsx`): 正解県 SVG パスへの発光パルスアニメーション。
     - Mode D (`MunicipalityMap.tsx`): Google Maps Data Layer の正解ポリゴン一時的ハイライト強調。
  5. アクセシビリティ対応:
     - `prefers-reduced-motion: reduce` 有効時に紙吹雪・バウンス・パルスを無効化。
     - スクリーンリーダー読み上げの重複防止と検証。
  6. 単体テスト・回帰テストの作成（`sound-effects.test.ts`, `confetti.test.tsx`）。

---

### Phase 4: 都道府県クイズ適用 & PC 大画面レイアウト最適化

- **目標**: 都道府県クイズ（`/quiz/prefecture`）への達成感・フィードバック統一適用と、PC画面（`md:`）での視認性向上。
- **タスク内容**:
  1. 都道府県クイズ（`app/(app)/quiz/prefecture/page.tsx`）への統合:
     - `FloatingFeedbackCard`、和音 SE、`ConfettiOverlay`（5連続）、パルス演出を組み込み。
     - 進行制御: 通常モード（2.0s）、タイムアタックモード（正解 500ms / 誤答 900ms）。
     - 地図フレーミングリセット: `JapanMap` に `qIdx={currentIndex}` を渡し、次問遷移時に確実に拡大状態をリセット（FR-007c）。
  2. PC / デスクトップ表示（`md:` 768px以上）の最適化:
     - `FloatingFeedbackCard` に `md:max-w-[480px]` / `md:max-h-[160px]`、文字サイズ拡大（`md:text-base` / `md:text-lg`）を適用。
  3. テストの拡充:
     - 都道府県クイズのフィードバック・進行・拡大リセット検証（`prefecture-quiz-feedback.test.tsx`）。

---

## Verification & Quality Assurance

- **全テスト通過**: `pnpm test`
- **厳格型検査**: `pnpm type-check`
- **Lint / Ratchet 検査**: `pnpm lint`, `pnpm lint:ratchet`
- **手動動作確認**: `quickstart.md` に定義されたシナリオ 1・2・3 の実機 375px 検証および PC 画面表示検証
