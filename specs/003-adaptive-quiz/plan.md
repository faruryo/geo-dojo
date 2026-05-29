# Implementation Plan: おすすめクイズ（適切クイズ推薦）

**Branch**: `003-adaptive-quiz` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-adaptive-quiz/spec.md`

## Summary

ユーザーの (難易度 × 地方 × モード) セルごとのセッション正答率移動平均から「適切ゾーン（Fit Zone, 60–80%）」を特定し、4 軸（適合・探索・成長・カバレッジ）+ 後退抑制ロジックで推薦セッションを構成する。既存テーブル（`municipality_quiz_results` / `municipality_master`）のみ使用、新テーブル・スキーマ変更は不要。エンジンは TypeScript の純粋関数として `lib/quiz/recommendation/` に集約し、Server Actions 経由で TanStack Query が読み出す。UI はダッシュボードと市区町村クイズトップの両方に共通のヒーローカード、推薦内容の確認はボトムシート（shadcn/ui Sheet）で実装し、ページ遷移を発生させない。既存のクイズ実行画面（`/quiz/municipality/[mode]`）を再利用し、推薦パラメータを URL クエリで引き渡す。

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 15.2.6+ (App Router, React 19)
**Primary Dependencies**: shadcn/ui `Sheet` コンポーネント（推薦内容ボトムシート用、未導入なら追加）、TanStack Query v5、Drizzle ORM、Tailwind CSS v4、lucide-react。新規外部ライブラリ追加なし。
**Storage**: Supabase (PostgreSQL) — 既存テーブル（`municipality_quiz_results` / `municipality_master`）のみ使用、スキーマ変更なし。Recommendation History Cache は `localStorage`。
**Testing**: 手動テスト（375px モバイル基準、各エッジケース）+ 型チェック（`pnpm lint`）。推薦エンジンは純粋関数なので軽量ユニットテスト（vitest 既導入なら）を Phase 2 で検討。
**Target Platform**: Web (PWA)、モバイルファースト、ダークモード（`#111111`）デフォルト。
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 推薦内容の生成（CTA タップから確認シート表示まで）1.5 秒未満（SC-003）。
**Constraints**: 新テーブル不要・スキーマ変更不要・新規外部 API 不要。既存クイズフロー（`/quiz/municipality/[mode]`）を再利用し、推薦パラメータは URL クエリで受け渡し（`?source=recommend&mode=B&difficulty=medium&regions=東北,関東&count=10&codes=...`）。
**Scale/Scope**: 1 ユーザーあたり 〜10,000 回答レコードまではクエリ時集計で対応可能（spec-002 と同等）。推薦エンジン呼び出しは CTA タップごとに 1 回（FR-014 で毎回再計算）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. セキュリティ & コンプライアンス

| Gate | Status | Notes |
|------|--------|-------|
| API キーの管理 | ✅ PASS | 新規 API キー不要。既存 Supabase 接続のみ |
| `NEXT_PUBLIC_` 制約 | ✅ PASS | 推薦エンジンは Server Actions 内で実行。クライアントには推薦結果（純データ）のみ返却 |
| Next.js ≥ 15.2.6 | ✅ PASS | 既存プロジェクトで 15.2.6+ |

### II. アーキテクチャ & パフォーマンス

| Gate | Status | Notes |
|------|--------|-------|
| PWA (`@serwist/next`) | ✅ PASS | 既存 PWA 構成に影響なし。推薦エンジンは認証必須でオンライン前提（キャッシュ不要） |
| 地図データ最適化 | ✅ PASS | 推薦エンジンは地図を使用しない（既存 TopoJSON はクイズ実行画面側で利用） |
| Read: TanStack Query | ✅ PASS | `useRecommendation` hook 経由で Server Action を呼び出し。`staleTime: 0`（FR-014）。 |
| Write: Server Actions | ✅ PASS | 推薦エンジンは Server Actions（`getRecommendation`）で実装。クイズ結果保存は既存の `saveMunicipalityQuizResult` を流用 |
| DB インデックス | ✅ PASS | 既存 `mqr_user_time_idx` / `mqr_user_code_idx` / `mm_difficulty_idx` / `mm_region_diff_idx` で全集計をカバー可能 |

### III. ロジック & UI

| Gate | Status | Notes |
|------|--------|-------|
| モバイルファースト (375px) | ✅ PASS | ヒーローカード・ボトムシート共に縦スクロールのみで完結（spec § UI 配置と見せ方） |
| ダークモード (`#111111`) | ✅ PASS | 既存テーマ準拠。ヒーローカードはアクセントカラー + dark 背景前提 |

**結果: 全ゲート PASS。違反なし。**

### Re-check after Phase 1 design

Phase 1 の `data-model.md` / `contracts/server-actions.md` / `quickstart.md` 出力後に再評価する。

| Gate | Status | Notes |
|------|--------|-------|
| Server Actions で Write なし | ✅ PASS | `getRecommendation` は読み取り専用（GET 相当）。クイズ結果保存は既存 `saveMunicipalityQuizResult` を流用 |
| TanStack Query キャッシュ | ✅ PASS | `useRecommendation` は `staleTime: 0`、`refetchOnMount: 'always'`、key に `userId` を含めて多ユーザー対応 |
| 新テーブル不要 | ✅ PASS | `data-model.md` — 全集計は既存テーブルクエリで完結。クラウド平均はリクエスト時集計（必要なら別途キャッシュは Phase 2 検討） |
| Recommendation History Cache: localStorage | ✅ PASS | DB テーブル不要、クライアント完結、24h 期限 |
| 375px 完結性 | ✅ PASS | ヒーローカード（1 カード）+ ボトムシート（sticky bottom CTA）でスクロール不要 |

**Phase 1 後再チェック: 全ゲート PASS。**

## Project Structure

### Documentation (this feature)

```text
specs/003-adaptive-quiz/
├── plan.md                    # This file
├── spec.md                    # Feature specification
├── research.md                # Phase 0: 技術調査結果
├── data-model.md              # Phase 1: データモデル（派生クエリ定義）
├── quickstart.md              # Phase 1: 開発セットアップ手順
├── contracts/
│   └── server-actions.md      # Phase 1: Server Actions 契約
├── checklists/
│   └── requirements.md        # Spec 品質チェックリスト
└── tasks.md                   # Phase 2: タスク定義（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
app/(app)/
├── page.tsx                                # 既存ダッシュボード — RecommendHeroCard を MilestoneBanner 直下に挿入
└── quiz/
    └── municipality/
        ├── page.tsx                        # 既存クイズトップ — RecommendHeroCard をモード一覧の上に挿入
        ├── actions.ts                      # 既存 — getRecommendation Server Action を追加
        └── [mode]/
            └── page.tsx                    # 既存クイズ実行 — ?source=recommend パラメータの受信と結果画面の主 CTA 追加

components/recommend/                       # 新規ディレクトリ — おすすめクイズの UI コンポーネント
├── recommend-hero-card.tsx                 # ダッシュボード/クイズトップ共通のヒーローカード
├── recommend-sheet.tsx                     # ボトムシート（shadcn/ui Sheet ラッパー）
├── recommend-content.tsx                   # シート内コンテンツ（推薦内容 + 根拠 + 上書き）
├── recommend-rationale.tsx                 # 根拠文 1〜2 行レンダー（テンプレート選択）
├── recommend-override.tsx                  # モード/問題数/除外地方の上書きフォーム（折りたたみ）
└── recommend-replay-button.tsx             # 結果画面の「もう一度おすすめでプレイ」CTA

components/ui/sheet.tsx                     # shadcn/ui Sheet（未導入なら `pnpm dlx shadcn@latest add sheet` で追加）

lib/quiz/recommendation/                    # 新規ディレクトリ — 推薦エンジン（純粋関数）
├── engine.ts                               # generateRecommendation() メインエントリ
├── types.ts                                # Recommendation, FitZone, Cell, LearnerState, CellAccuracy などの型
├── cell-stats.ts                           # セッション境界推定 + セル別正答率移動平均算出
├── fit-zone.ts                             # 適切ゾーン抽出 + 隣接セルバックオフ
├── axes/
│   ├── exploration.ts                      # 探索軸（未プレイ・低制覇セル）
│   ├── coverage.ts                         # カバレッジ軸（cell 内未経験市区町村確保）
│   └── progression.ts                      # 成長軸（隣接単方向昇格判定）+ 後退抑制
├── rationale.ts                            # 根拠文テンプレート選択（8 カテゴリ）
└── history-cache.ts                        # localStorage の Recommendation History Cache I/O（クライアント側）

lib/hooks/
└── useRecommendation.ts                    # 新規 — TanStack Query hook (staleTime: 0)
```

**Structure Decision**: 既存の Next.js App Router 構成を踏襲。
- 推薦エンジン本体は **`lib/quiz/recommendation/` に純粋関数として集約** し、Server Action からも将来の任意の呼び出しからも再利用可能にする。軸ロジックは `axes/` 配下に分割し、テスト容易性を確保。
- UI コンポーネントは **`components/recommend/`** に新ディレクトリを作り、既存の `components/dashboard/` や `components/map/` と同列に配置（spec-002 の構成踏襲）。ヒーローカード・ボトムシートはダッシュボードとクイズトップで共通利用。
- Server Action は既存の `app/(app)/quiz/municipality/actions.ts` に追加（クイズドメインの操作を 1 ファイルに集約）。
- 状態管理は TanStack Query のキャッシュ + ボトムシート開閉の URL ステート（`?recommend=open`）の組み合わせ。

## Complexity Tracking

> Constitution Check 全ゲート PASS のため、記載対象なし。
