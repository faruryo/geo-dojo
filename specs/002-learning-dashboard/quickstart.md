# Quickstart: 学習ダッシュボード

**Branch**: `002-learning-dashboard` | **Date**: 2026-05-25

## 前提条件

- Node.js 24+, pnpm
- Supabase プロジェクト（ローカル or リモート）が稼働中
- `municipality_master` テーブルにデータが投入済み（`pnpm tsx scripts/sync-municipality-master.ts`）
- テスト用のクイズ結果データがあると望ましい（市区町村クイズを数回プレイ）

## セットアップ

```bash
# 1. ブランチ切替
git checkout 002-learning-dashboard

# 2. 依存追加（チャートライブラリ）
pnpm add recharts

# 3. 開発サーバ起動
pnpm dev
```

## 新規ファイル構成

```text
app/(app)/
├── page.tsx                          # ダッシュボードページ（トップページ）
├── bottom-nav.tsx                    # 既存: ホームタブ追加
├── dashboard/
│   └── actions.ts                    # ダッシュボード用 Server Actions
└── quiz/                             # 既存: 変更なし

lib/hooks/
├── useDashboardSummary.ts            # 新規
├── useAccuracyTrend.ts               # 新規
├── useWeaknessRanking.ts             # 新規（既存 useMunicipalityWeakness.ts とは別）
├── useStreak.ts                      # 新規
├── useDifficultyProgress.ts          # 新規
├── useReviewRecommendations.ts       # 新規
└── useRecentSessions.ts              # 新規

components/dashboard/
├── summary-cards.tsx                 # US1: サマリーカード
├── accuracy-chart.tsx                # US2: 正答率推移グラフ（Recharts）
├── weakness-ranking.tsx              # US3: 苦手ランキング
├── streak-display.tsx                # US4: ストリーク表示
├── completion-progress.tsx           # US5: コンプリート率プログレスバー
├── difficulty-progress.tsx           # US6: 難易度別プログレスバー
├── review-recommendations.tsx        # US7: 復習おすすめ
├── weekly-best.tsx                   # US8: 今週のベスト
├── session-comparison.tsx            # US9: 前回比較
├── milestone-banner.tsx              # US10: マイルストーン通知
└── empty-state.tsx                   # 共通: 空状態表示
```

## 動作確認

1. `pnpm dev` でサーバー起動
2. ログイン後、`/` にリダイレクトされることを確認
3. クイズ履歴がある場合: サマリーカード・グラフ・ランキング等が表示される
4. クイズ履歴がない場合: 空状態メッセージとクイズへの導線が表示される
5. ボトムナビに3タブ（ホーム・都道府県・市区町村）が表示される

## DB変更

なし。既存テーブル・インデックスのみ使用。

## 環境変数

追加なし。既存の Supabase 接続情報のみ使用。
