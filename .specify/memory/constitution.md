<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0
Bump type: MAJOR — Initial constitution ratification, replacing all placeholder tokens

Modified principles:
  - [PRINCIPLE_1_NAME] → I. セキュリティ & コンプライアンス (new)
  - [PRINCIPLE_2_NAME] → II. アーキテクチャ & パフォーマンス (new)
  - [PRINCIPLE_3_NAME] → III. ロジック & UI (new)
  - Removed: [PRINCIPLE_4_NAME], [PRINCIPLE_5_NAME] (not needed for this project)

Added sections:
  - 技術スタック & バージョン
  - 開発コマンド
  - ディレクトリ構造 (LIFT原則)
  - コーディング規約

Templates requiring updates:
  - ✅ .specify/memory/constitution.md — updated (this file)
  - ✅ .specify/templates/plan-template.md — Constitution Check gates align with 3 principles; no structural change needed
  - ✅ .specify/templates/spec-template.md — generic structure; no changes needed
  - ✅ .specify/templates/tasks-template.md — task phases align with principle-driven work; no changes needed

Deferred TODOs:
  - None — all placeholders resolved

Ratification date: 2026-05-06 (initial)
-->

# GeoDojo Constitution

GeoDojo は、記憶科学に基づいた GeoGuessr（日本）学習プラットフォームです。
分散学習（SRS）、画像アノテーション、および AI による自動コンテンツ生成を活用し、
地域固有の視覚特徴の習得を高速化します。

## 技術スタック & バージョン

| 分類 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js (App Router, React 19) | 15.2.6+ |
| スタイリング | Tailwind CSS + shadcn/ui | v4 |
| DB / 認証 / ストレージ | Supabase (PostgreSQL) | — |
| ORM | Drizzle ORM (TypeScript-first) | — |
| データ取得 | TanStack Query | v5 |
| PWA | @serwist/next (Workbox fork) | — |
| 地図 | @vnedyalk0v/react19-simple-maps + TopoJSON | — |
| AI | Gemini 2.5 Flash (@google/generative-ai) | — |
| パッケージマネージャ | pnpm | — |

## Core Principles

### I. セキュリティ & コンプライアンス

- **APIキーの管理**: サーバー専用キー（`E_STAT_APP_ID` 等）は `NEXT_PUBLIC_` を付けず
  クライアントに露出させてはならない。クライアント公開キー（`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`）は
  Google Cloud Console で HTTP referrer 制限を設定すること。
- **Next.js バージョン**: RSC 経由の脆弱性（CVE-2025-66478）対策のため、
  必ず **15.2.6 以上** を使用すること。

**Why**: API キー漏洩はコスト爆発と不正利用に直結する。referrer 制限のないクライアント公開キーは
第三者に悪用されるリスクがある。旧 Next.js は既知の RCE 脆弱性を含む。

### II. アーキテクチャ & パフォーマンス

- **PWA 実装**: `@serwist/next` を使用すること。`@ducanh2912/next-pwa` は
  Next.js 15 / Turbopack 非対応のため使用禁止。
- **地図データの最適化**: 日本地図は `mapshaper` で GeoJSON から **TopoJSON** に変換して使用する。
  バンドルサイズ削減のため、非同期フェッチでロードすること。
- **データフロー**:
  - **Read**: クエリのキャッシュ管理には TanStack Query を使用すること。
  - **Write**:
    - **原則**: アプリ内 UI からのデータ更新には **Server Actions** を使用すること。
      型安全性（コンパイル時検出）・Progressive Enhancement・バンドルサイズ削減の利点がある。
      TanStack Query の `useMutation` と組み合わせて使うこと。
    - **例外**: 以下のケースでは API Routes（Route Handlers）を使用してよい：
      webhook・ストリーミング応答・公開エンドポイント・非同期バックグラウンド処理。
- **DB インデックス**: パフォーマンス維持のため、`srs_records` の `(user_id, due_date)`
  複合インデックスを常に維持すること。

**Why**: TopoJSON は GeoJSON 比で通常 80% 以上のサイズ削減を達成し、モバイル通信でも
高速に動作する。TanStack Query + Server Actions の分離はキャッシュの一貫性を保証し、
不要な再レンダリングを防ぐ。API Routes は webhook や外部トリガーに使用し、
UI 起点の Write とは明確に役割を分ける。

### III. ロジック & UI

- **モバイルファースト**: iPhone 等の 2 画面利用を想定し、幅 375px を基準に設計すること。
  ダークモード（`#111111`）をデフォルトとすること。

**Why**: 375px 基準はターゲットユーザーの主要端末に最適化されている。

## 開発コマンド

| コマンド | 用途 |
|---------|------|
| `pnpm install` | 依存関係インストール |
| `pnpm dev` | 開発サーバ起動 |
| `pnpm build` | ビルド |
| `pnpm lint` | 型チェック / Lint |
| `pnpm drizzle-kit generate` | DB スキーマ生成 |
| `pnpm drizzle-kit push` | DB マイグレーション適用 |

## ディレクトリ構造 (LIFT 原則)

```text
app/          # Next.js App Router（認証、API、画面）
components/   # UI コンポーネント（flashcard, map, annotation）
lib/          # コアロジック（srs アルゴリズム, db クライアント, gemini ラッパー）
public/       # 静的資産（TopoJSON 等）
supabase/     # マイグレーションファイルおよび Edge Functions (AI Cron 用)
```

## コーディング規約

- **TypeScript**: `strict: true` を前提とし、型定義を徹底すること。
- **Drizzle**: `schema.ts` を唯一の真実のソースとしてテーブルを定義すること。
  生の SQL マイグレーションで schema.ts を迂回することを禁止する。
- **UI**: Tailwind のユーティリティクラスを優先し、複雑な CSS-in-JS を避けること。
- **状態管理**: 複雑なグローバルストアを避け、URL ステートまたは TanStack Query の
  キャッシュを活用すること。

## Governance

- この憲法はプロジェクト内の全ての他のガイドライン・慣習より優先される。
- **改定手続き**: 原則の追加・変更・削除は PR にて提案し、レビュー後に
  本ファイルを更新すること。変更箇所は Sync Impact Report に記録すること。
- **バージョン管理**: Semantic Versioning に従うこと。
  - MAJOR: 後方互換性のない原則の削除・再定義
  - MINOR: 原則の追加またはセクションの実質的拡張
  - PATCH: 明確化・文言修正・タイポ修正
- **コンプライアンスレビュー**: 機能実装前に plan.md の「Constitution Check」ゲートで
  本憲法への適合を確認すること。特にセキュリティ原則（I）は全 PR でチェック必須。
- **ランタイムガイダンス**: 開発時の詳細なコンテキストは `CLAUDE.md` を参照すること。

**Version**: 2.0.0 | **Ratified**: 2026-05-06 | **Last Amended**: 2026-05-25
