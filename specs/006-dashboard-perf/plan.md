# Implementation Plan: ダッシュボード（トップ）表示速度の改善

**Branch**: `006-dashboard-perf` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-dashboard-perf/spec.md`

## Summary

トップ（認証後ダッシュボード）の初回表示が **約14.3秒**（本番 HAR 実測）。原因は client component が **11本の read 系 Server Action を発火し、Next.js がそれらを完全に直列実行**することにある（HAR で重なり 0/10）。加えて各アクションが毎回 `getUser()` でネットワーク認証往復を行い、`getDashboardSummary` は直列10クエリ、`getRecommendation` は重い上に重複呼び出し（3.5秒ぶん）されている。

技術アプローチ: **read 経路を「直列 Server Action」から「サーバ側並列プリフェッチ＋ TanStack Query ハイドレーション」へ移行**する。初回表示は認証1回＋全クエリ `Promise.all` の1バッチに収束させ、フィルタ変更などオンデマンド再取得は既存の取得関数を流用する。これは憲法 II「Read は TanStack Query」にも合致し、既存の表示内容・数値を変えずに高速化する。

## Technical Context

**Language/Version**: TypeScript 5 / Node.js (Vercel Functions, Fluid Compute) / React 19
**Primary Dependencies**: Next.js 15.2.6 (App Router), TanStack Query v5, Drizzle ORM (postgres-js), @supabase/ssr
**Storage**: Supabase PostgreSQL（Transaction Pooler, `prepare:false`）。スキーマ変更なし
**Testing**: Vitest（純粋関数）。性能は改修前後の HAR 比較で検証
**Target Platform**: Vercel（本番）/ ローカル supabase stack
**Project Type**: Web application（Next.js single app）
**Performance Goals**: トップ初回表示 **< 3秒（目標 < 2秒）**。サーバ往復を直列合計 → 並列最遅1本に収束
**Constraints**: 表示内容・指標・フィルタ挙動のリグレッションなし。新規テーブル・スキーマ変更なし。`(app)/layout.tsx` の `force-dynamic`（認証必須）は維持
**Scale/Scope**: 影響範囲は `app/(app)/page.tsx` とダッシュボード read 系フック／アクション（約11関数）。単一ユーザー単位のクエリ

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 後に再確認。*

| 原則 | 判定 | 根拠 |
|------|------|------|
| I. セキュリティ & コンプライアンス | ✅ Pass | キー露出・Next.js バージョンに変更なし。認証は維持（getUser→getClaims はローカル検証でセキュリティ低下せず） |
| II. アーキテクチャ & パフォーマンス | ✅ Pass（むしろ是正） | 憲法は **Read=TanStack Query / Write=Server Action**。現状は read を直列 Server Action で実装しており本来の意図とズレ。本改修で read をサーバ並列プリフェッチ＋Query ハイドレーションへ寄せ、**Write 系 Server Action（クイズ結果保存等）は変更しない**。`srs_records(user_id, due_date)` インデックスは維持 |
| III. ロジック & UI | ✅ Pass | UI レイアウト・モバイルファースト・ダークモードに変更なし |

**ゲート結果**: 違反なし。Complexity Tracking 不要。

## Project Structure

### Documentation (this feature)

```text
specs/006-dashboard-perf/
├── plan.md          # 本ファイル
├── research.md      # Phase 0: アプローチ比較と決定
├── data-model.md    # Phase 1: スキーマ変更なし（記録のみ）
├── quickstart.md    # Phase 1: 改修前後の測定手順
└── tasks.md         # Phase 2: /speckit-tasks で生成
```

### Source Code (repository root)

```text
app/(app)/
├── page.tsx                 # [変更] client → server wrapper 化（プリフェッチ＋HydrationBoundary）。表示本体は client のまま分離
├── layout.tsx               # [維持] force-dynamic / 認証
└── dashboard/
    ├── actions.ts           # [変更] getDashboardSummary を Promise.all 化／read 関数を共有モジュール経由に
    └── queries.ts           # [新規] 認証非依存の純粋 read クエリ群（userId 引数）。SA と RSC 双方から再利用

lib/
├── auth/current-user.ts     # [新規] リクエスト単位で認証1回。getClaims（ローカルJWT検証）優先 + getUser フォールバック
├── dashboard/prefetch.ts    # [新規] 既定フィルタの全 read を Promise.all で取得し dehydrate するサーバ関数
└── hooks/use*.ts            # [調整] staleTime / 重複の見直し（特に useRecommendation）

components/dashboard/        # [原則維持] 各部品はハイドレート済みキャッシュを読むだけ（初回フェッチ消滅）
components/recommend/recommend-hero-card.tsx  # [調整] page.tsx の二重配置に伴う getRecommendation 重複の解消
```

**Structure Decision**: 既存の単一 Next.js アプリ構成を維持。新規ファイルは「認証の一元化」「read クエリの純粋化（userId 引数化）」「サーバ並列プリフェッチ」の3点に限定し、UI コンポーネント階層は変えない。

## アプローチ概要（詳細は research.md）

採用案: **サーバ側並列プリフェッチ ＋ TanStack Query ハイドレーション（ハイブリッド）**

- 初回ロード: `page.tsx` をサーバ component 化し、既定フィルタ（all/全国）の全 read を **認証1回 ＋ Promise.all** で取得 → `HydrationBoundary` でクライアントへ渡す。クライアント部品は初回フェッチを行わず即描画。
- オンデマンド（フィルタ変更・手動更新）: 既存の取得関数を流用（同時に走るのはせいぜい1〜2本なので直列化の害は無視可能）。
- 並行して効く **クイックウィン**（順序独立・低リスク）:
  1. `getRecommendation` の重複排除（`page.tsx` の `RecommendHeroCard` 二重配置 ＋ `staleTime:0/refetchOnMount:'always'` 見直し）。単独で約3.5秒削減見込み。
  2. `getDashboardSummary` 内の直列10クエリを `Promise.all` 化。
  3. 認証を `getClaims`（ローカル JWT 検証）に寄せ、ネットワーク往復を削減。

期待効果: 14.3秒 → 初回プリフェッチ1バッチ（最遅クエリ＋認証1回）に収束し、**目標 < 2秒**。

## 段階リリース方針

- **Phase A（クイックウィン）**: 上記1〜2を先行投入。アーキ変更前でも体感が大きく改善し、リスク最小。HAR で効果確認。
- **Phase B（アーキ移行）**: プリフェッチ＋ハイドレーション本体。`page.tsx` 分割、`queries.ts`／`prefetch.ts`／`current-user.ts` 新設。
- **Phase C（仕上げ）**: 認証 `getClaims` 化、残存 read のハイドレーション網羅、再計測と数値一致確認。

## Complexity Tracking

> Constitution Check に違反なし — 記入不要。
