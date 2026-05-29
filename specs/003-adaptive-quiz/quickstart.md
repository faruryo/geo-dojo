# Quickstart: おすすめクイズ 開発セットアップ

**Branch**: `003-adaptive-quiz` | **Date**: 2026-05-28

## 前提

- Node.js 24 LTS / pnpm がインストール済み
- `.env.local` に Supabase 接続情報設定済み
- spec-001 / spec-002 までの実装が main にマージ済み（既存テーブル `municipality_quiz_results` / `municipality_master` が存在）

## ステップ 1: ブランチ切替

```bash
git switch 003-adaptive-quiz
pnpm install
```

## ステップ 2: shadcn/ui Sheet コンポーネント追加（未導入なら）

```bash
# 既存に components/ui/sheet.tsx があるか確認
ls components/ui/sheet.tsx 2>/dev/null || pnpm dlx shadcn@latest add sheet
```

導入後、`components/ui/sheet.tsx` が生成される。Radix UI Dialog 依存も自動追加される。

## ステップ 3: 推薦エンジンの実装順序（推奨）

ボトムアップで実装することを推奨。各ステップは独立してテスト可能。

1. **`lib/quiz/recommendation/types.ts`** — 全型定義（`data-model.md` ベース）
2. **`lib/quiz/recommendation/cell-stats.ts`** — セッション抽出 + セル別正答率移動平均
3. **`lib/quiz/recommendation/fit-zone.ts`** — Fit Zone 抽出
4. **`lib/quiz/recommendation/axes/exploration.ts`** — 探索軸
5. **`lib/quiz/recommendation/axes/coverage.ts`** — カバレッジ軸
6. **`lib/quiz/recommendation/axes/progression.ts`** — 成長軸 + 後退抑制
7. **`lib/quiz/recommendation/rationale.ts`** — 根拠文テンプレート（R-008）
8. **`lib/quiz/recommendation/engine.ts`** — `generateRecommendation` メインエントリ
9. **`lib/quiz/recommendation/history-cache.ts`** — クライアント側 localStorage I/O

## ステップ 4: Server Action 追加

`app/(app)/quiz/municipality/actions.ts` に `getRecommendation` を追加。`contracts/server-actions.md` を参照。

## ステップ 5: TanStack Query Hook

`lib/hooks/useRecommendation.ts` を新規作成:

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { getRecommendation } from '@/app/(app)/quiz/municipality/actions';
import { readRecommendationHistory } from '@/lib/quiz/recommendation/history-cache';

export function useRecommendation() {
  return useQuery({
    queryKey: ['recommendation'],
    queryFn: async () => {
      const history = readRecommendationHistory();
      return await getRecommendation({
        excludeCodes: history?.lastCodes ?? [],
      });
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
```

## ステップ 6: UI コンポーネントの実装順序

1. **`components/recommend/recommend-hero-card.tsx`** — ダッシュボード / クイズトップ共通
2. **`components/recommend/recommend-rationale.tsx`** — 根拠文表示
3. **`components/recommend/recommend-override.tsx`** — モード/問題数/除外地方フォーム（折りたたみ）
4. **`components/recommend/recommend-content.tsx`** — シート内のメインコンテンツ
5. **`components/recommend/recommend-sheet.tsx`** — ボトムシートラッパー
6. **`components/recommend/recommend-replay-button.tsx`** — 結果画面用 CTA

## ステップ 7: 配置と既存ファイルへの注入

| ファイル | 変更内容 |
|---------|---------|
| `app/(app)/page.tsx` | `MilestoneBanner` 直下に `<RecommendHeroCard />` を挿入 |
| `app/(app)/quiz/municipality/page.tsx` | モード A/B/C/D カード群の上に `<RecommendHeroCard />` を挿入 |
| `app/(app)/quiz/municipality/[mode]/page.tsx` | `?source=recommend&codes=...` クエリの解析、`buildQuestions` 前段の `codes` 絞り込み、結果画面に `<RecommendReplayButton />` 追加 |

## ステップ 8: 動作確認

```bash
pnpm dev
```

ブラウザで http://localhost:3000 にログイン後、以下を確認:

### 確認 1: コールドスタート（履歴ゼロユーザー）

- 新規アカウントでログイン
- ダッシュボードのヒーローカードに「✨ 今日のおすすめクイズ」が表示
- 根拠文が「初めての方向けに ☆入門 を全国から出題します」
- タップ → ボトムシート表示 → 「そのまま開始」 → 全国 × ☆ × 10 問のクイズが開始

### 確認 2: 通常ユーザー（履歴あり）

- 既存テストアカウントでログイン（履歴 100 件以上想定）
- ダッシュボードのヒーローカード根拠文が学習状態に応じて変化
- ボトムシート内「内容を変える」展開でモード/問題数/地方の上書きが可能
- 「そのまま開始」/ 上書き後の「開始」どちらでも クイズ実行画面に遷移

### 確認 3: 成長軸発火

- DB を直接いじって、☆入門の直近 5 セッション平均を > 80% にする
- おすすめクイズを開始 → 根拠文に「☆入門が安定したので、☆☆中級に挑戦しましょう」と表示されること
- 出題に ☆☆中級 の市区町村が含まれること

### 確認 4: 後退抑制

- DB を直接いじって、直近 1 セッションの正答率を < 30% にする
- おすすめクイズを開始 → 根拠文に「少しペースを落として…」と表示されること
- 難易度が上がらないこと

### 確認 5: 結果画面の「もう一度おすすめでプレイ」

- 任意のおすすめクイズを完了
- 結果画面に「もう一度おすすめでプレイ」CTA が主ボタンとして表示
- タップ → ボトムシート再表示 → 推薦内容が直前と少なくとも 50% 入れ替わること（FR-014）

### 確認 6: localStorage

- 開発者ツール → Application → Local Storage → `geodojo:recommendation:history`
- `lastCodes` と `storedAt` が保存されていること
- 24h 経過後の挙動: 手動で `storedAt` を 25h 前に書き換え、リロード → 推薦が空 `excludeCodes` で実行される

## ステップ 9: 型チェック

```bash
pnpm lint
```

エラーなしで通ることを確認。

## ステップ 10: モバイル確認

- Chrome DevTools のデバイスエミュレータで 375px 幅に設定
- ダッシュボード / クイズトップでヒーローカードが横スクロールなしで表示
- ボトムシートが画面下からせり上がり、`そのまま開始` ボタンが sticky で常に画面内に見える
- 「内容を変える」展開時も主 CTA が常に画面内

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `getRecommendation` が `Unauthorized` を返す | Supabase セッションが切れている。ログインし直す |
| 推薦が常にランダムフォールバック | DB の `municipality_quiz_results` に該当 userId のデータがあるか確認、`getMunicipalityWeakness` の動作確認 |
| ボトムシートが開かない | shadcn/ui Sheet が導入されているか、`components/ui/sheet.tsx` の存在確認 |
| 「もう一度おすすめでプレイ」が表示されない | URL に `?source=recommend` が含まれているか確認 |
| 推薦が遅い（SC-003 違反） | DB インデックス確認 (`mqr_user_time_idx`, `mqr_user_code_idx`, `mm_difficulty_idx`)。`buildLearnerState` のクエリログを確認 |

## 次のステップ

- `/speckit-tasks` で実装タスクを生成
- タスクごとに小さく PR を積み上げて統合
