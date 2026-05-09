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

- **APIキーの隠蔽**: Google Maps API キーをクライアント側に露出させてはならない。
  Street View 画像の取得は必ず `/api/image-proxy` を経由させること。
- **Street View 規約遵守**: ストリートビューのパノラマ画像本体を Supabase Storage や
  DB に保存・再配布してはならない（規約第 3.2.3 条違反）。保存するのは `pano_id` のみとし、
  表示時に動的フェッチすること。
- **Next.js バージョン**: RSC 経由の脆弱性（CVE-2025-66478）対策のため、
  必ず **15.2.6 以上** を使用すること。
- **AI モデル**: **Gemini 2.5 Flash** を使用すること。Gemini 2.0 Flash は
  2026 年 6 月 1 日に停止予定のため使用禁止。

**Why**: API キー漏洩はコスト爆発と不正利用に直結する。Street View 利用規約違反は
Google との契約違反になりサービス停止リスクがある。旧 Next.js は既知の RCE 脆弱性を含む。

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
不要な再レンダリングを防ぐ。API Routes は非同期バックグラウンド処理（Gemini 生成等）や
外部トリガーに使用し、UI 起点の Write とは明確に役割を分ける。

### III. ロジック & UI

- **SRS アルゴリズム**: SM-2 を簡略化した 3 段階評価（1: 全然、3: うろ覚え、5: 完璧）を
  採用すること。独自アルゴリズムに変更する場合は Governance に従い改定を行うこと。
- **アノテーション**: レスポンシブ対応のため、座標は画像に対する相対パーセント
  （`0.0`〜`1.0`）で保存し、SVG で描画すること。ピクセル座標での保存は禁止。
- **モバイルファースト**: iPhone 等の 2 画面利用を想定し、幅 375px を基準に設計すること。
  ダークモード（`#111111`）をデフォルトとすること。

**Why**: 相対座標で保存することで、異なる解像度のデバイス間でのアノテーション位置の
ズレを防止できる。375px 基準はターゲットユーザーの主要端末に最適化されている。

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

**Version**: 1.1.0 | **Ratified**: 2026-05-06 | **Last Amended**: 2026-05-09
