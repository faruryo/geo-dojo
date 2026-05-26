# Implementation Plan: 学習ダッシュボード

**Branch**: `002-learning-dashboard` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-learning-dashboard/spec.md`

## Summary

市区町村クイズの既存データ（`municipality_quiz_results`）を集計し、学習ダッシュボードをログイン後のトップページ（`/`）として提供する。正答率推移グラフ、苦手ランキング、ストリーク、コンプリート率、難易度別進捗、復習おすすめ、ベスト記録、前回比較、マイルストーン通知の10機能を実装する。新テーブルは不要で、既存テーブルのクエリ集計 + Recharts による可視化で構成する。

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 15.2.6+ (App Router, React 19)
**Primary Dependencies**: Recharts (新規追加), TanStack Query v5, shadcn/ui, Drizzle ORM, Tailwind CSS v4, lucide-react
**Storage**: Supabase (PostgreSQL) — 既存テーブルのみ使用、スキーマ変更なし
**Testing**: 手動テスト（モバイル375px基準）+ 型チェック (`pnpm lint`)
**Target Platform**: Web (PWA), モバイルファースト
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: ダッシュボード全体の初期表示 3秒未満、グラフ切替 1秒未満
**Constraints**: 新テーブル不要、既存クイズ機能に影響なし
**Scale/Scope**: 1ユーザーあたり ~10,000 回答レコードまではクエリ時集計で対応

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. セキュリティ & コンプライアンス

| Gate | Status | Notes |
|------|--------|-------|
| APIキーの管理 | ✅ PASS | 新規APIキー不要。既存 Supabase 接続のみ使用 |
| NEXT_PUBLIC_ 制約 | ✅ PASS | ダッシュボードは Server Actions 経由のみでDB参照。クライアントにDB接続情報を露出しない |
| Next.js >= 15.2.6 | ✅ PASS | 既存プロジェクトで 15.2.6+ を使用中 |

### II. アーキテクチャ & パフォーマンス

| Gate | Status | Notes |
|------|--------|-------|
| PWA (@serwist/next) | ✅ PASS | 既存PWA構成に影響なし。ダッシュボードページはオンライン前提（キャッシュ不要） |
| 地図データ最適化 | ✅ PASS | ダッシュボードで地図は使用しない（将来の地方制覇マップはP2候補） |
| Read: TanStack Query | ✅ PASS | 全集計データを TanStack Query hooks 経由で取得。staleTime 60s |
| Write: Server Actions | ✅ PASS | ダッシュボードは読み取り専用。書き込みなし |
| DBインデックス | ✅ PASS | 既存インデックス (`mqr_user_time_idx`, `mqr_user_code_idx`) でカバー可能 |

### III. ロジック & UI

| Gate | Status | Notes |
|------|--------|-------|
| モバイルファースト (375px) | ✅ PASS | 全セクション縦スクロール、横スクロール不発生を保証 |
| ダークモード (#111111) | ✅ PASS | 既存テーマ設定に準拠。Recharts のカラーパレットをダークモード対応にする |

**結果: 全ゲート PASS。違反なし。**

### Re-check after Phase 1 design

| Gate | Status | Notes |
|------|--------|-------|
| Server Actions で Write なし | ✅ PASS | contracts/server-actions.md — 全アクションが読み取り専用（GET相当） |
| TanStack Query キャッシュ | ✅ PASS | 全 hooks に queryKey + staleTime 設定済み |
| 新テーブル不要 | ✅ PASS | data-model.md — 全集計が既存テーブルのクエリで完結 |
| マイルストーン既読: localStorage | ✅ PASS | DB テーブル不要、クライアント完結 |

**Phase 1 後再チェック: 全ゲート PASS。**

## Project Structure

### Documentation (this feature)

```text
specs/002-learning-dashboard/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: 技術調査結果
├── data-model.md        # Phase 1: データモデル（派生クエリ定義）
├── quickstart.md        # Phase 1: セットアップ手順
├── contracts/
│   └── server-actions.md  # Phase 1: Server Actions 契約
├── checklists/
│   └── requirements.md  # Spec品質チェックリスト
└── tasks.md             # Phase 2: タスク定義（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
app/(app)/
├── page.tsx                          # ダッシュボードページ（トップページ、新規）
├── bottom-nav.tsx                    # 既存: ホームタブ追加（変更）
├── layout.tsx                        # 既存: 変更なし
├── dashboard/
│   └── actions.ts                    # ダッシュボード用 Server Actions（新規）
└── quiz/                             # 既存: 変更なし

components/dashboard/                 # ダッシュボード UI コンポーネント（新規ディレクトリ）
├── summary-cards.tsx
├── accuracy-chart.tsx
├── weakness-ranking.tsx
├── streak-display.tsx
├── completion-progress.tsx
├── difficulty-progress.tsx
├── review-recommendations.tsx
├── weekly-best.tsx
├── session-comparison.tsx
├── milestone-banner.tsx
└── empty-state.tsx

lib/hooks/                            # TanStack Query hooks（新規ファイル追加）
├── useDashboardSummary.ts
├── useAccuracyTrend.ts
├── useWeaknessRanking.ts
├── useStreak.ts
├── useDifficultyProgress.ts
├── useReviewRecommendations.ts
└── useRecentSessions.ts
```

**Structure Decision**: 既存の Next.js App Router 構成を踏襲。ダッシュボード固有のコンポーネントは `components/dashboard/` ディレクトリに集約し、既存の `components/map/` 等と同列に配置する。Server Actions は `app/(app)/dashboard/actions.ts` に集約し、既存のクイズ用 actions とは分離する。

## Complexity Tracking

> Constitution Check 全ゲート PASS のため、記載対象なし。
