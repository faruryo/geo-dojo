# Implementation Plan: 科学的間隔反復による間違い復習

**Branch**: `005-spaced-review` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-spaced-review/spec.md`

## Summary

一度間違えた市区町村を **SM-2（間隔反復）+ アクティブリコール** で復習する機能。復習単位は (市区町村コード, 出題モード) で、新テーブル `srs_records` に SM-2 状態（ease factor / interval / repetition / due_date / status）を保持する。回答（通常クイズ・復習セッション双方）ごとに Server Action で SM-2 を更新し、ダッシュボードの「復習おすすめ」を期日駆動（`due_date <= now`）の「今日の復習 N件」へ置き換える。復習セッションはモード混在（A/B/C/D）で、既存のクイズ進行UIを `QuizRunner` クライアントコンポーネントへ抽出して再利用する。導入時は既存誤答ログから `srs_records` を一括バックフィルする。

## Technical Context

**Language/Version**: TypeScript (strict), React 19 / Next.js 15.2.6 (App Router, Turbopack)
**Primary Dependencies**: Drizzle ORM 0.41, postgres.js, @supabase/ssr, TanStack Query v5, @vnedyalk0v/react19-simple-maps, shadcn/ui + Tailwind v4
**Storage**: Supabase PostgreSQL（Drizzle schema.ts が唯一の真実のソース、migration は drizzle-kit generate → CI migrate.yml で適用）
**Testing**: 現状フレームワーク無し → 本機能で **Vitest** を導入し `lib/quiz/srs/` の純粋関数（SM-2 計算）を単体テスト（決定的でテスト価値が高い）
**Target Platform**: PWA（モバイルファースト、iPhone 375px 基準、ダークモード `#111111` デフォルト）
**Project Type**: Web application（Next.js 単一プロジェクト、Server Actions + RSC + クライアント進行）
**Performance Goals**: 「今日の復習」件数取得・復習対象一覧取得が体感即時（既存ダッシュボードと同等）。`srs_records (user_id, due_date)` 複合インデックスで期日クエリを高速化（憲法 II 必須）
**Constraints**: 書き込みは Server Actions、読み取りは TanStack Query（憲法 II）。新規 API キー無し。Next.js 15.2.6 以上維持（憲法 I）
**Scale/Scope**: 個人学習アプリ。1ユーザーあたり最大で全国市区町村数(約1,900) × 出題モード4 ≈ 数千行の `srs_records`。クエリは常に userId スコープ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | ゲート | 判定 |
|------|--------|------|
| **I. セキュリティ & コンプライアンス** | 新規 API キー無し。`srs_records` への全アクセスは Server Action 内で `supabase.auth.getUser()` → `userId` スコープ。migration に RLS ポリシー同梱（userId = auth.uid()）。Next.js 15.2.6 維持 | ✅ PASS |
| **II. アーキテクチャ & パフォーマンス** | Write=Server Actions（SM-2 更新・復習取得）、Read=TanStack Query フック。`srs_records` に **`(user_id, due_date)` 複合インデックス**を定義（憲法明記）。地図データ・PWA に変更なし | ✅ PASS |
| **III. ロジック & UI** | 復習セッションUIは既存クイズUIを抽出再利用し、375px・ダークモード踏襲 | ✅ PASS |
| **コーディング規約** | テーブル定義は `schema.ts` のみ。データバックフィルと RLS は migration の SQL として同梱（テーブル定義の迂回ではない）。TypeScript strict | ✅ PASS |

**違反なし** → Complexity Tracking は記載不要。

## Project Structure

### Documentation (this feature)

```text
specs/005-spaced-review/
├── plan.md              # This file
├── research.md          # Phase 0 output（SM-2 パラメータ・統合方針の決定）
├── data-model.md        # Phase 1 output（srs_records スキーマ・状態遷移）
├── quickstart.md        # Phase 1 output（動作確認手順）
├── contracts/           # Phase 1 output（Server Action / フック契約）
│   └── server-actions.md
└── checklists/
    └── requirements.md  # /speckit-specify 生成済み
```

### Source Code (repository root)

> 実装後の実ファイル構成（plan 当初案から増補した分を反映）

```text
lib/
├── db/
│   └── schema.ts                 # [変更] srs_records テーブル + (user_id, due_date) index 追加
├── quiz/
│   ├── municipality-data.ts      # [変更] dedupeInstancesByPrefecture 追加（B007 / Mode A 多重防止）
│   └── srs/                      # [新規] SM-2 純粋ロジック（recommendation/ の兄弟）
│       ├── types.ts              #   SrsState, ReviewQuality, SrsUpdateResult, SrsStatus
│       ├── sm2.ts                #   applySm2(state, quality) → 次状態（純粋関数）
│       ├── scheduler.ts          #   isDue / shouldGraduate / alreadyAdvancedToday
│       └── update.ts             #   computeSrsUpdate（同日ガード含む更新判定・純粋）
└── hooks/
    ├── useDueReviewSummary.ts    # [新規] 今日の復習件数・進捗サマリ（Read）
    ├── useUpcomingReviewSchedule.ts # [新規] 今後7日の日別予定
    ├── useReviewItemList.ts      # [新規] 復習中一覧（ページング+モードフィルタ）
    └── useReviewModeBreakdown.ts # [新規] モード別 復習中/定着済み 集計

app/(app)/
├── page.tsx                      # [変更] ReviewProgress カードを追加
├── quiz/
│   ├── municipality/
│   │   ├── actions.ts            # [変更] saveMunicipalityQuizResult に SM-2 upsert（computeSrsUpdate）統合
│   │   └── [mode]/page.tsx       # [変更] 進行UIを QuizRunner へ抽出して利用
│   └── review/
│       ├── actions.ts            # [新規] getDueReviewItems（期日到来分・優先順）
│       ├── page.tsx              # [新規] モード混在の復習セッション（QuizRunner 利用）
│       └── items/page.tsx        # [新規] 復習中一覧（サマリ表+フィルタ+ページング / FR-016a,b,c）
└── dashboard/
    └── actions.ts                # [変更] getDueReviewSummary / getUpcomingReviewSchedule / getReviewItemList / getReviewModeBreakdown 追加、旧 getReviewRecommendations 撤去

components/
├── quiz/
│   └── quiz-runner.tsx           # [新規] 既存 playing ループ（A/B/C/D 描画＋recordAndAdvance）を抽出
└── dashboard/
    ├── review-recommendations.tsx # [変更] 「今日の復習 N件」期日駆動カードへ
    └── review-progress.tsx       # [新規] 進捗（復習中/定着済み件数・7日予定・一覧導線）

supabase/migrations/
└── 0001_messy_meltdown.sql       # [新規] srs_records DDL + RLS + 既存誤答ログのバックフィル INSERT...SELECT

__tests__/lib/quiz/
├── srs/sm2.test.ts               # [新規] SM-2 計算
├── srs/scheduler.test.ts         # [新規] 期日・卒業・同日ガード
├── srs/update.test.ts            # [新規] computeSrsUpdate（新規/同日ガード/卒業/復帰）
└── mode-a-dedupe.test.ts         # [新規] dedupeInstancesByPrefecture（B007）
```

**Structure Decision**: 既存の Next.js 単一プロジェクト構成を踏襲。純粋ロジックは `lib/quiz/srs/`（既存 `lib/quiz/recommendation/` と同じ「quiz ドメインの純粋ロジック」階層）に置き、副作用（DB・認証）は Server Action 層（`app/(app)/.../actions.ts`）に閉じる。混在セッションの進行UIは肥大化した `[mode]/page.tsx`(471行) から `QuizRunner` を抽出し、通常クイズと復習セッションの両方で再利用する（DRY、UI 一貫性）。

## Complexity Tracking

> 違反なし — 記載不要。
