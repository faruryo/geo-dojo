# Implementation Plan: 復習完了時のSRS進捗・定着可視化

**Branch**: `030-review-outcome-feedback` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/030-review-outcome-feedback/spec.md`

## Summary

復習バッチの完了画面に、問題ごとの SRS 変化（卒業・次回期日・同日ガード・保存失敗）と「通常の速さならあと○回で卒業」の目安を表示する。Mode A の同名多県は県別の行で表示し、サマリは1問1件で「定着／復習継続／保存失敗」に集計する。

技術方針は次の3点。

1. **回答前・回答後の2回スナップショット**: 出題前に保存対象コード×モードの SRS 状態と誤答歴を取得し（`getSrsSnapshot`）、完了後に保存成功分だけを再取得する。差分からラベルを決める。
2. **保存成否の配線**: `recordAndAdvance` が問題ごとの `QuestionSaveMeta` を蓄積し、`triggerAdvance` → `advanceQuestion` → `onComplete(results, meta)` へ渡す。
3. **判定はすべて純粋関数**: 残り回数シミュレーション（`simulation.ts`）、キー検証（`snapshot.ts`）、整合ガード・ラベル決定・集計（`outcome.ts`）を I/O から分離してケース表でテストする。

## Technical Context

**Language/Version**: TypeScript 5（strict）、Node 25、pnpm 10

**Primary Dependencies**: Next.js 15.2.6（App Router / React 19）、Tailwind CSS v4、lucide-react、TanStack Query v5、Drizzle ORM

**Storage**: Supabase PostgreSQL。スキーマ変更なし（`srs_records` と `municipality_quiz_results` を read のみ）

**Testing**: Vitest（`pnpm test`）、`pnpm type-check`、`pnpm lint` / `pnpm lint:ratchet`

**Target Platform**: モバイル Web / PWA（375px 基準・ダークモード）

**Project Type**: Next.js Web アプリ

**Performance Goals**: 完了画面は回答後スナップショットを待たずに描画を開始する。スナップショットは1バッチあたり回答前1回・回答後1回の Server Action 呼び出し（各最大100キー、2クエリ）

**Constraints**: 回答前スナップショットは出題開始前に完了させる（レース防止）。取得失敗はクイズの進行・保存を妨げない。通常クイズ画面の挙動は変えない

**Scale/Scope**: 1バッチ最大20問。Mode A の同名多県は最大4県（池田町）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 要件 | 適合性 | 判定 |
|---|---|---|---|
| I. セキュリティ & コンプライアンス | API キー非露出、Next.js 15.2.6+ | 新規キーなし。`getSrsSnapshot` は `requireUserId` で本人の行に限定し、モード・コード形式・件数を検証する。新規テーブルなし（RLS 追加不要） | PASS |
| II. アーキテクチャ & パフォーマンス | Read は TanStack Query / Write は Server Actions、`(user_id, due_date)` インデックス維持 | スナップショットは画面遷移に紐づく一回限りの read。キャッシュ共有の必要がないため、既存 `getDueReviewItems` と同じく Server Action を直接呼ぶ。`srs_records` は一意制約 `(user_id, municipality_code, mode)` で引ける。インデックス変更なし | PASS |
| III. ロジック & UI | 375px モバイルファースト、ダーク `#111111` | サマリはチップ横並び（折り返し可）、詳細は `<details>` の縦リストで、横スクロールが出ない | PASS |

Phase 1 後の再確認: 新しい違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/030-review-outcome-feedback/
├── spec.md
├── plan.md              # 本ファイル
├── research.md          # 技術決定
├── data-model.md        # スナップショット・メタ・成果の型と判定表
├── quickstart.md        # 検証手順
├── contracts/
│   ├── srs-snapshot-action.md     # getSrsSnapshot の入出力・検証
│   └── review-outcome-ui.md       # 完了画面の構成・ラベル文言
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
lib/quiz/
├── quiz-session-core.ts          # [MODIFY] QuestionSaveMeta 型 + toQuestionSaveMeta
└── srs/
    ├── simulation.ts             # [NEW] simulateStepsToGraduation, MAX_SIMULATION_STEPS
    ├── snapshot.ts               # [NEW] SrsSnapshotKey/Entry 型, validateSrsSnapshotKeys
    └── outcome.ts                # [NEW] questionSrsKeys, isSaveMetaConsistent, buildReviewOutcome, 文言整形
components/quiz/
├── use-quiz-actions.ts           # [MODIFY] meta 蓄積・triggerAdvance へ受け渡し
├── use-quiz-state.ts             # [MODIFY] advanceQuestion(results, meta) → onComplete(results, meta)
├── use-quiz-session.ts           # [MODIFY] onComplete 型
├── quiz-runner.tsx               # [MODIFY] onComplete 型
├── quiz-result-card.tsx          # [MODIFY] footer スロット追加
└── review-outcome-section.tsx    # [NEW] ReviewOutcomeSummary / ReviewOutcomeDetails（表示専用）
app/(app)/quiz/review/
├── actions.ts                    # [MODIFY] getSrsSnapshot 追加
└── page.tsx                      # [MODIFY] 回答前スナップショット・回答後取得・成果表示
.design-sync/
├── config.json                   # [MODIFY] QuizResultCard の footer、新コンポーネント2件
├── entry.tsx                     # [MODIFY] export 追加
└── previews/                     # [NEW] ReviewOutcomeSummary.tsx / ReviewOutcomeDetails.tsx、QuizResultCard に footer バリアント
__tests__/
├── lib/quiz/srs/simulation.test.ts       # [NEW]
├── lib/quiz/srs/snapshot.test.ts         # [NEW]
├── lib/quiz/srs/outcome.test.ts          # [NEW]
└── components/quiz/use-quiz-actions-advance.test.tsx  # [MODIFY] meta 受け渡し
AGENTS.md                         # [MODIFY] SPECKIT ポインタと復習成果の不変条件
```

**Structure Decision**: SRS の純粋判定は既存の `lib/quiz/srs/` に置き、表示コンポーネントは `components/quiz/` に置く。Server Action は復習画面専用なので `app/(app)/quiz/review/actions.ts` に置く。

## Implementation Phases

### Phase A: 純粋関数とテスト（US1・US2・US3 の土台）

1. `simulation.ts`: `applySm2(state, 4)` を繰り返し、`!everWrong && repetition >= 2` の早期卒業も含めて卒業までの回数を返す。20回で打ち切り `null`。
2. `snapshot.ts`: キー検証（配列、1〜100件、モード whitelist、コード `/^\d{5}$/`、重複除去）。
3. `outcome.ts`: 出題→キー変換、メタ整合ガード、行ラベル決定（FR-005 の優先順）、残り回数、1問1件サマリ、文言整形。

### Phase B: データ取得と配線

1. `getSrsSnapshot(keys)`（Server Action）。
2. `QuestionSaveMeta` を `recordAndAdvance` で生成し、`onComplete` まで受け渡す。

### Phase C: UI 統合

1. `QuizResultCard` に `footer` を追加（既存画面は未使用なので表示不変）。
2. `ReviewOutcomeSummary` / `ReviewOutcomeDetails` を実装。
3. 復習ページで、出題前スナップショット → 出題 → 完了時に回答後取得 → 成果表示。古い応答の破棄とフォールバックも入れる。

### Phase D: 同期とドキュメント

`.design-sync`（entry / componentSrcMap / dtsPropsFor / previews / `build-css.mjs`）、`AGENTS.md`。

## Complexity Tracking

> Constitution Check 違反なし（N/A）
