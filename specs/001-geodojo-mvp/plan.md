# Implementation Plan: GeoDojo MVP（Phase 1）

**Branch**: `001-geodojo-mvp` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-geodojo-mvp/spec.md`

## Summary

GeoGuessr（日本）学習プラットフォームのMVPを実装する。
SRSフラッシュカード（SM-2 3段階評価）・日本地図タップクイズ・手動カード作成・AI生成レビューの4機能を、
Next.js 15 App Router + Supabase + Drizzle ORM で構築する。
セキュリティ制約（APIキー隠蔽・Street View画像保存禁止）を厳守する。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 24 LTS
**Primary Dependencies**:
- Next.js 15.2.6+ (App Router, React 19)
- Tailwind CSS v4 + shadcn/ui
- Drizzle ORM + drizzle-kit
- TanStack Query v5 (React Query)
- @serwist/next (PWA / Workbox)
- @vnedyalk0v/react19-simple-maps + topojson-client
- @google/generative-ai (Gemini 2.5 Flash)
- @supabase/supabase-js

**Storage**: Supabase PostgreSQL（ユーザーデータ）+ Supabase Storage（ユーザーアップロード画像）
**Testing**: vitest（unit）/ playwright（e2e、MVP後）
**Target Platform**: PWA (mobile-first 375px、iOS Safari / Chrome Android)
**Project Type**: web-app（Next.js PWA）
**Performance Goals**: 地図タップ→フィードバック < 1秒、カード評価UX < 30秒開始
**Constraints**:
- Google Maps APIキーをクライアント側に露出禁止（`/api/image-proxy` 必須）
- Street Viewパノラマ画像本体をDB/ストレージに保存禁止（pano_id のみ保持）
- Next.js 15.2.6+ 必須（CVE-2025-66478 対策）
- ダークモード（`#111111`）をデフォルト
**Scale/Scope**: MVP（1開発者、ユーザー数数十〜数百人規模）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 要件 | Plan での対応 | 判定 |
|------|------|--------------|------|
| I. セキュリティ | APIキー隠蔽（`/api/image-proxy`） | `app/api/image-proxy/route.ts` を実装 | ✅ |
| I. セキュリティ | pano_id のみ保存、画像本体禁止 | schema: `cards.pano_id` のみ。Storage に保存するのはユーザーアップロード画像のみ | ✅ |
| I. セキュリティ | Next.js 15.2.6+ | package.json に `"next": ">=15.2.6"` を設定 | ✅ |
| I. セキュリティ | Gemini 2.5 Flash（2.0 Flash 禁止） | `lib/ai/gemini.ts` で `gemini-2.5-flash` モデル指定 | ✅ |
| II. アーキテクチャ | PWA: @serwist/next | `next.config.ts` に withSerwist を適用 | ✅ |
| II. アーキテクチャ | TopoJSON 非同期フェッチ | `public/japan.topojson` を `fetch` で非同期ロード | ✅ |
| II. アーキテクチャ | Read = TanStack Query | `lib/hooks/` に useDueCards, useCards 等を定義 | ✅ |
| II. アーキテクチャ | Write = Server Actions | `app/` 配下の actions.ts で submitRating 等を定義 | ✅ |
| II. アーキテクチャ | srs_records (user_id, due_date) 複合インデックス | schema.ts: `index('srs_user_due_idx').on(userId, dueDate)` | ✅ |
| III. ロジック | SM-2 簡略化（1/3/5評価） | `lib/srs/algorithm.ts` で実装 | ✅ |
| III. ロジック | アノテーション相対座標（0.0〜1.0） | annotations テーブル: `x_ratio`, `y_ratio` (real) | ✅ |
| III. ロジック | モバイルファースト 375px、ダークモード `#111111` | tailwind.config.ts + globals.css | ✅ |

**Constitution Check: 全ゲートPASS → Phase 0 に進む**

## Project Structure

### Documentation (this feature)

```text
specs/001-geodojo-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-routes.md
│   └── server-actions.md
└── tasks.md             # /speckit-tasks command output
```

### Source Code (repository root)

```text
app/
├── layout.tsx                     # Root layout (ThemeProvider, QueryProvider, Serwist)
├── page.tsx                       # Redirect to /study or /login
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (app)/
│   ├── layout.tsx                 # App shell（bottom nav, auth guard）
│   ├── study/
│   │   └── page.tsx               # SRS学習セッション
│   ├── quiz/
│   │   └── page.tsx               # 地図タップクイズ
│   ├── cards/
│   │   ├── page.tsx               # カード一覧（タグフィルタ付き）
│   │   └── new/page.tsx           # 手動カード作成
│   └── ai-review/
│       └── page.tsx               # AI生成候補レビュー
└── api/
    ├── image-proxy/route.ts       # Google Maps APIキー隠蔽プロキシ
    └── ai-generate/route.ts       # Gemini非同期生成トリガー

components/
├── flashcard/
│   ├── FlashCard.tsx              # カード表示 + アノテーションオーバーレイ
│   ├── RatingButtons.tsx          # 1/3/5 評価ボタン
│   └── AnnotationOverlay.tsx      # SVGレイヤー（相対座標で描画）
├── map/
│   ├── JapanMap.tsx               # react19-simple-maps ラッパー（Client）
│   └── PrefectureLabel.tsx        # 都道府県ラベル・ハイライト
├── annotation/
│   ├── AnnotationEditor.tsx       # 画像上インタラクティブ編集（Client）
│   └── MarkerPin.tsx              # マーカーピン SVG コンポーネント
└── ai/
    └── AiReviewCard.tsx           # AI候補レビューカード

lib/
├── db/
│   ├── schema.ts                  # Drizzle スキーマ（唯一の真実のソース）
│   └── index.ts                   # DB接続（Supabase connection string）
├── srs/
│   └── algorithm.ts               # SM-2 簡略化実装
├── ai/
│   └── gemini.ts                  # Gemini 2.5 Flash ラッパー
├── supabase/
│   └── client.ts                  # Supabase クライアント
└── hooks/
    ├── useDueCards.ts             # TanStack Query: 当日期限カード
    ├── useCards.ts                # TanStack Query: タグ絞り込みカード一覧
    └── useAiCandidates.ts        # TanStack Query: AI候補一覧

public/
└── japan.topojson                 # 国土地理院GeoJSON → mapshaper変換済み

supabase/
├── migrations/                    # drizzle-kit generate 出力
└── functions/
    └── ai-cron/                   # Gemini 定期生成 Edge Function（MVP後）
```

**Structure Decision**: Next.js App Router の Route Groups で認証/アプリを分離。
lib/ に全コアロジックを集約し、LIFT原則に従いコンポーネントを機能別に配置。
バックエンドロジックは Server Actions（書き込み）と TanStack Query（読み込み）で明確に分離する。

## Complexity Tracking

> Constitution Check 全 PASS のため、このセクションは不要。
