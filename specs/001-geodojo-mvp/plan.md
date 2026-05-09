# Implementation Plan: GeoDojo MVP（Phase 1 + 市区町村クイズ）

**Branch**: `main` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-geodojo-mvp/spec.md`

## Summary

GeoGuessrを学習したい日本語話者向けに、SM-2ベースのSRS学習・都道府県地図タップクイズ・手動カード作成・AI生成カードレビュー・市区町村クイズ（モードA〜D）の5機能を持つPWAを Next.js 15 App Router + Supabase + Gemini 2.5 Flash で実装する。T001〜T058（MVP）実装済み。市区町村クイズ（US5）を追加実装する。

## Technical Context

**Language/Version**: TypeScript / Next.js 15.2.6（App Router, React 19）
**Primary Dependencies**: Drizzle ORM, TanStack Query v5, @serwist/next, @vnedyalk0v/react19-simple-maps, @google/generative-ai, Tailwind CSS v4, shadcn/ui
**Storage**: Supabase（PostgreSQL + Storage）。新規テーブル: `municipality_quiz_results`
**Testing**: 手動 Acceptance Scenario テスト
**Target Platform**: Web PWA（モバイルファースト 375px、ダークモード `#111111`）
**Project Type**: web-service（Next.js App Router PWA）
**Performance Goals**: 市区町村タップ→フィードバック < 1秒（SC-009）
**Constraints**: 幅375px基準、APIキーはサーバー側のみ、`japan-municipalities.topojson` < 1MB
**Scale/Scope**: 個人 MVPユーザー向け、市区町村約1,741件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. セキュリティ & コンプライアンス ✅

| チェック項目 | 状態 | 備考 |
|-------------|------|------|
| Google Maps API キーをクライアント側に露出させない | ✅ PASS | 市区町村クイズは Maps API 不使用 |
| Street View 画像本体を保存しない | ✅ PASS | 市区町村クイズは画像なし |
| Next.js 15.2.6 以上を使用 | ✅ PASS | 変更なし |
| Gemini 2.5 Flash を使用 | ✅ PASS | 市区町村クイズは AI 不使用 |

### II. アーキテクチャ & パフォーマンス ✅

| チェック項目 | 状態 | 備考 |
|-------------|------|------|
| PWA は @serwist/next | ✅ PASS | `japan-municipalities.topojson` も CacheFirst に追加 |
| 地図データは TopoJSON + 非同期フェッチ | ✅ PASS | `MunicipalityMap` は `public/japan-municipalities.topojson` を fetch |
| Write = Server Actions | ✅ PASS | `saveMunicipalityQuizResult`・`getMunicipalityWeakness` を actions.ts に実装 |
| `srs_user_due_idx` 複合インデックス維持 | ✅ PASS | 変更なし |
| 新規インデックス | ✅ PASS | `mqr_user_code_idx`・`mqr_user_time_idx` を追加 |

### III. ロジック & UI ✅

| チェック項目 | 状態 | 備考 |
|-------------|------|------|
| アノテーション座標は相対パーセント | ✅ PASS | 市区町村クイズは非対象 |
| モバイルファースト 375px、ダークモードデフォルト | ✅ PASS | 市区町村クイズも同基準で実装 |

## Project Structure

### Documentation (this feature)

```text
specs/001-geodojo-mvp/
├── plan.md              # This file
├── research.md          # R-001〜R-011（市区町村クイズ追記済み）
├── data-model.md        # municipality_quiz_results テーブル追記済み
├── quickstart.md        # TopoJSON生成手順追記要
├── contracts/
│   ├── api-routes.md    # 既存 API（変更なし）
│   └── server-actions.md # saveMunicipalityQuizResult・getMunicipalityWeakness 追記済み
└── tasks.md             # /speckit-tasks で更新要
```

### Source Code（追加・変更ファイル）

```text
app/
└── (app)/
    └── quiz/
        └── municipality/
            ├── page.tsx          # 市区町村クイズページ（モード選択・設定・ゲームループ）
            └── actions.ts        # saveMunicipalityQuizResult / getMunicipalityWeakness

components/
└── map/
    └── MunicipalityMap.tsx       # モードD用（pref_ja フィルタ、都道府県別 projectionConfig）

lib/
└── hooks/
    └── useMunicipalityWeakness.ts # TanStack Query: 苦手市区町村リスト取得

public/
├── japan-municipalities.topojson  # 新規（mapshaper 変換、目標 1MB 以下）
└── municipalities.json            # 新規（静的リスト、約1,741件・200KB以下）

scripts/
└── generate-municipalities.ts     # TopoJSON から municipalities.json を生成するスクリプト

lib/db/schema.ts                   # municipality_quiz_results テーブル追加
app/sw.ts                          # japan-municipalities.topojson を CacheFirst に追加
```

### 既存ファイル（変更なし）

```text
app/(app)/quiz/page.tsx            # 都道府県クイズ（変更なし）
components/map/JapanMap.tsx        # 都道府県地図（変更なし）
```

**Structure Decision**: 既存の Next.js App Router 単一プロジェクト構成を踏襲。市区町村クイズは `app/(app)/quiz/municipality/` に独立ページとして追加。`JapanMap` は変更せず、`MunicipalityMap` を新規作成する。

## 実装時に実測で確定する数値（暫定値の置換ポリシー）

以下の数値は計画段階の暫定値であり、実装時に実測してから plan.md / research.md を更新すること。

| 暫定値 | 確定タイミング | 確定方法 |
|--------|-------------|---------|
| `japan-municipalities.topojson` < 2MB | TopoJSON 生成直後 | `ls -lh` で実測。2MB を超える場合は `-simplify` 値を 0.05 → 0.02 等に下げて再生成 |
| `municipalities.json` < 300KB | JSON 生成直後 | `wc -c` で実測 |
| `prefectureCenter.scale` の係数 8000 | モードD 実装時 | 47都道府県を順表示し、画面外はみ出し・小さすぎを目視確認して調整 |
| 苦手判定ウィンドウ「直近100件」 | 実装後の実利用 | ユーザー1人あたりの累積回答数を観察して調整 |
| `weight = 1 + error_rate * 4` の係数 4 | 実装後の実利用 | A/B テストまたはユーザーフィードバック |
| `-simplify 0.05` | TopoJSON 生成時 | 0.02 / 0.05 / 0.1 を視認性とサイズで比較 |

これらは MVP 実装ブロッカーではないが、リリース前にすべて実測値に置き換えること。

## Complexity Tracking

> Constitution Check: すべてのゲートがパス — 違反なし。
