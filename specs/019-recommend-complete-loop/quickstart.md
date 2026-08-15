# Quickstart & Verification: 019-recommend-complete-loop

## 1. 概要
本機能はクイズ完了画面における最新の復習予定（明日の件数・7日間スケジュール）の表示と、おすすめクイズの即時ループプレイ導線の実装です。

## 2. 自動テストの実行

```bash
# ヘルパー関数の単体テストを実行
pnpm test __tests__/lib/quiz/srs/schedule-helper.test.ts

# 全体テスト・型チェック・Lint
npx tsc --noEmit
pnpm test
pnpm lint:ratchet
```

## 3. UI 動作確認項目
- `/quiz/municipality/B?source=recommend` でクイズ完了時：
  - 完了画面に「明日の復習予定: X件」とミニ棒グラフが表示されること
  - 最上部に「✨ もう一度おすすめでプレイ」が表示され、タップで `/?recommend=open` に遷移すること
- `/quiz/review` で復習クイズ完了時：
  - 完了画面に同様の復習予定ミニカードが表示されること
