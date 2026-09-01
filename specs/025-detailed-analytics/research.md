# Research & Technology Decisions: 詳細分析ページ (025-detailed-analytics)

## Context & Scope

PR #70（`024-conquest-mode-a`）でトップ（ダッシュボード）画面をシンプルに保つため、学習の内訳データ（正答率推移グラフ、苦手市区町村ランキング、モード別・難易度別の消化数、ストリーク等の詳細）を独立した詳細分析画面（`/analytics`）に移行する。

## Key Decisions

### Decision 1: 画面ルーティングとURL
- **Decision**: `app/(app)/analytics/page.tsx` を新規作成し、URLパスを `/analytics` とする。
- **Rationale**: Next.js App Routerの `(app)` グループ内で認証必須の画面として統一し、セマンティックで簡潔なURL `/analytics` を採用する。
- **Alternatives considered**:
  - `/dashboard/stats`: 階層が深くなりURLが長くなる。
  - `/stats`: 悪くないが、他の画面構成（`/quiz/...`）と並ぶ主要機能として `/analytics` がより直感的。

### Decision 2: ナビゲーション導線
- **Decision**: `app/(app)/bottom-nav.tsx` に4つ目のタブ「分析」（`/analytics`、`BarChart2` または `TrendingUp` アイコン）を追加する。
- **Rationale**: ユーザーヒアリング（Clarification）でOption Aを選択。主要なナビゲーションとして1タップでアクセス可能にする。375px幅のモバイル画面でも4タブ構成は標準的なタブ幅（約93px/タブ）で余裕をもって収まる。
- **Alternatives considered**:
  - トップ画面にのみリンクを置く: ドリルダウンが必要で閲覧頻度が下がる。

### Decision 3: データフェッチ戦略（Prefetch + TanStack Query）
- **Decision**: トップ画面と同様に Server Component（`analytics/page.tsx`）で `getAnalyticsDehydratedState()` を実行し、主要サマリーをプリフェッチして `HydrationBoundary` でクライアントに渡す。クライアント側のフィルター操作時は TanStack Query が `getAccuracyTrend`, `getWeaknessRanking`, `getDifficultyProgress` 等の Server Action / Query をオンデマンド取得する。
- **Rationale**: ファーストビューの高速化（SSR/プリフェッチ）と、クライアント操作時（期間変更など）のスムーズな非同期更新を両立できる。Constitution Principle II に完全に適合する。
- **Alternatives considered**:
  - クライアントフェッチのみ（SSRプリフェッチなし）: 初回ローディングちらつきが発生する。
  - Server Component のみ（URLクエリパラメータ同期）: フィルター変更ごとにサーバー往復と全画面再レンダリングが発生し操作感が損なわれる。

### Decision 4: 既存コンポーネントとクエリの再利用
- **Decision**: `components/dashboard/` に残っている `AccuracyChart`, `WeaknessRanking`, `DifficultyProgress`, `SummaryCards`, `StreakDisplay`, `FilterBar`, `EmptyState` および `app/(app)/dashboard/actions.ts` / `lib/db/queries/dashboard.ts` のクエリ関数をそのまま再利用・再構成する。
- **Rationale**: これらは過去の仕様（002/006等）で既に最適化・型付けされており、DBスキーマやクエリの変更なしに安全に集約・表示できる。
- **Alternatives considered**:
  - すべて新規作成: 不要な重複実装とメンテナンスコストの増大（YAGNI原則違反）。

### Decision 5: モバイル表示とレイアウト（縦スクロール1画面）
- **Decision**: 縦スクロール1画面に「学習統計サマリー & ストリーク」→「期間・地方フィルター & 正答率推移グラフ」→「モード・難易度別クリア状況」→「苦手市区町村ランキング」の順で配置する。
- **Rationale**: ユーザーヒアリング（Clarification）でOption Aを選択。一覧性が高く、モバイル端末（375px）でスクロールしながら全体の学習状況を把握できる。
