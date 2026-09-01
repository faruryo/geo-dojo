# Implementation Plan: 詳細分析ページ (025-detailed-analytics)

**Branch**: `025-detailed-analytics` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-detailed-analytics/spec.md`

## Summary

PR #70（`024-conquest-mode-a`）でトップ画面を薄くしたことに伴い、学習の内訳データ（正答率推移グラフ、苦手市区町村ランキング、モード別・難易度別クリア状況、ストリーク等の詳細）を独立した詳細分析画面（`/analytics`）に移行・集約する。ボトムナビゲーションに「分析」タブを追加し、既存の最適化済みコンポーネント・クエリ（`queryKeys` ファクトリの `weakness(period, mode, region)` 拡張、サマリー・推移・難易度別進捗における Mode A 正規化、サーバー authoritative タイムスタンプ付与 & SRS 更新維持、`getCompletionByModeData` 再利用による A/D 制覇率算出を含む）を再利用・拡張して素早く安全に実装する。

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), Node.js 25

**Primary Dependencies**: Next.js 15.2.6 (App Router, React 19), TanStack Query v5, Tailwind CSS v4, Lucide React

**Storage**: PostgreSQL (Supabase) + Drizzle ORM（既存 `municipality_quiz_results`, `municipality_master`, `srs_records` を参照。新規テーブル追加なし）

**Testing**: Vitest (`pnpm test`), TypeScript strict (`pnpm type-check`), ESLint (`pnpm lint`)

**Target Platform**: PWA (Web, モバイルファースト 375px 基準, ダークモード `#111111`)

**Project Type**: Web Application (Next.js App Router)

**Performance Goals**: ファーストビュー（`/analytics`）初期表示 < 1s（Server Component prefetch活用）、フィルター操作時のグラフ・苦手ランキング更新 < 500ms

**Constraints**: RLS準拠（ユーザー別データ隔離）、375px幅でのレスポンシブ崩れ防止、Mode A同名・複数県の出題正規化（サーバー authoritative タイムスタンプ付与・SRS更新維持と過去レガシー近似集約）、新規集計テーブルなし

**Scale/Scope**: 1新画面（`/analytics`）、1ナビゲーション変更（`BottomNav`）、既存コンポーネント再配置・配線、`saveMunicipalityQuizResults` バッチ保存 & SRS更新、`getWeaknessRankingData` 期間・モード・地方フィルター拡張、`getDashboardSummaryData` / `getAccuracyTrendData` / `getDifficultyProgressData` の Mode A 正規化 & A/D 制覇率算出、`queryKeys.dashboard.weakness(period, mode, region)` 拡張

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. セキュリティ & コンプライアンス**: ✅ パス。既存の認証スコープ済みクエリ（`requireUserId()`）を経由し、RLSが有効な `municipality_quiz_results` から自身のリザルトのみを取得する。
- **II. アーキテクチャ & パフォーマンス**: ✅ パス。ReadはTanStack Query + Server Component prefetch（`HydrationBoundary`、`queryKeys` ファクトリ準拠）を使用。DBスキーマ変更なし。
- **III. ロジック & UI**: ✅ パス。375px幅基準のモバイルファースト設計、ダークモード（`#111111`）対応。

## Project Structure

### Documentation (this feature)

```text
specs/025-detailed-analytics/
├── spec.md              # 仕様書
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
├── plan.md              # 本実装計画書
├── research.md          # 技術調査・意思決定
├── data-model.md        # データモデル・型定義
├── contracts/
│   └── ui-and-actions.md # インターフェース契約
├── quickstart.md        # 動作検証・手順書
└── tasks.md             # タスクリスト
```

### Source Code Layout

```text
app/
└── (app)/
    ├── bottom-nav.tsx            # ボトムナビに「分析」タブ（/analytics）を追加
    └── analytics/
        └── page.tsx              # 詳細分析 Server Component (SSR prefetch)

components/
└── analytics/
    └── analytics-client.tsx      # 詳細分析画面のクライアントコンポーネント

lib/
├── analytics/
│   └── prefetch.ts               # 詳細分析用プリフェッチ（queryKeys ファクトリ準拠）
└── query-keys.ts                 # weakness(period, mode, region) キー拡張
```

**Structure Decision**:
既存の `components/dashboard/` 配下のコンポーネント（`AccuracyChart`, `WeaknessRanking`, `DifficultyProgress`, `SummaryCards`, `StreakDisplay`, `FilterBar`, `EmptyState`）および `lib/db/queries/dashboard.ts` のクエリを利用し、`WeaknessRanking` の期間・モード・地方サーバー側フィルター拡張、サマリー・推移・難易度進捗の Mode A 正規化、A/D 制覇率算出（`getCompletionByModeData` 再利用）、`queryKeys` を用いて、新設する `components/analytics/analytics-client.tsx` にてレイアウト・配線を行う。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| なし | - | - |
